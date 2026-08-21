#!/usr/bin/env bash
#
# Moves the Trakheesi registry into this app's production database.
#
# Additive only. It creates five new tables, adds three values to user_role,
# grants permit roles to four existing people, and copies the registry across.
# It does not alter or delete a single existing row, and nothing it creates is
# visible until the merged code is deployed — so it is safe to run BEFORE the
# deploy, which is the point: verify the data first, deploy second.
#
#   scripts/cutover.sh --check    preflight only, touches nothing
#   scripts/cutover.sh            back up, migrate, import, verify
#
# Reads NEON_DATABASE_URL from .env (this app) and DATABASE_URL from the
# registry's .env.vercel. Override either with TARGET_URL / SOURCE_URL.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="${REGISTRY_DIR:-$HERE/../project_tracker}"
BACKUP_DIR="${BACKUP_DIR:-$HERE/../cutover-backups}"
CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

fail() { echo "  ✗ $1" >&2; exit 1; }
ok() { echo "  ✓ $1"; }

echo "== preflight =="

TARGET_URL="${TARGET_URL:-$(grep -E '^NEON_DATABASE_URL=' "$HERE/.env" | cut -d= -f2-)}"
[ -n "$TARGET_URL" ] || fail "no NEON_DATABASE_URL in .env — set TARGET_URL"
SOURCE_URL="${SOURCE_URL:-$(grep -E '^DATABASE_URL=' "$REGISTRY/.env.vercel" | cut -d= -f2-)}"
[ -n "$SOURCE_URL" ] || fail "no DATABASE_URL in $REGISTRY/.env.vercel — set SOURCE_URL"

psql "$TARGET_URL" -tAc 'select 1' >/dev/null || fail "cannot reach the target database"
ok "target reachable"
psql "$SOURCE_URL" -tAc 'select 1' >/dev/null || fail "cannot reach the registry database"
ok "registry reachable"

# Guard against pointing both ends at the same place, which would truncate the
# registry and then import from the wreckage.
[ "$TARGET_URL" != "$SOURCE_URL" ] || fail "source and target are the same database"
ok "source and target differ"

applied=$(psql "$TARGET_URL" -tAc 'select count(*) from drizzle.__drizzle_migrations')
echo "  migrations applied on target: $applied"
[ "$applied" -ge 24 ] || fail "target is behind: expected at least 24 migrations, found $applied"

# The registry tables must not already exist, or the import would truncate real
# data on a re-run someone did not mean to do.
existing=$(psql "$TARGET_URL" -tAc "select count(*) from pg_tables where schemaname='public' and tablename in ('projects','permits','permit_files','developers','permit_requests')")
if [ "$applied" -ge 25 ]; then
  ok "registry migrations already applied ($existing/5 tables present)"
else
  [ "$existing" = "0" ] || fail "registry tables already exist but migration 0025 has not run — resolve by hand"
  ok "registry tables absent, as expected before 0024"
fi

src_projects=$(psql "$SOURCE_URL" -tAc 'select count(*) from projects')
src_files=$(psql "$SOURCE_URL" -tAc 'select count(*) from permit_files')
src_requests=$(psql "$SOURCE_URL" -tAc 'select count(*) from permit_requests')
echo "  registry holds: $src_projects projects, $src_files QR files, $src_requests requests"
if [ "$src_requests" != "0" ]; then
  echo "  ! the registry has $src_requests permit request(s)."
  echo "    import-registry.sh does not copy requests. Move them by hand or accept the loss." >&2
fi

# Everyone who held a registry role, so the grants in 0025 can be sanity-checked
# against who actually exists here.
echo "  registry roles vs accounts here:"
while IFS='|' read -r email role; do
  [ -n "$email" ] || continue
  here=$(psql "$TARGET_URL" -tAc "select coalesce(array_to_string(roles,','),'') from users where email='$email'")
  if [ -z "$here" ]; then
    printf '    %-38s %-9s NO ACCOUNT HERE\n' "$email" "$role"
  else
    printf '    %-38s %-9s -> %s\n' "$email" "$role" "$here"
  fi
done < <(psql "$SOURCE_URL" -tAc 'select email, role from users order by email')

if $CHECK_ONLY; then
  echo
  echo "preflight only — nothing was changed."
  exit 0
fi

echo
echo "== backup =="
mkdir -p "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M%S)
pg_dump "$TARGET_URL" --no-owner --no-acl -f "$BACKUP_DIR/pwa-$stamp.sql"
ok "target -> $BACKUP_DIR/pwa-$stamp.sql ($(du -h "$BACKUP_DIR/pwa-$stamp.sql" | cut -f1))"
pg_dump "$SOURCE_URL" --no-owner --no-acl -f "$BACKUP_DIR/registry-$stamp.sql"
ok "registry -> $BACKUP_DIR/registry-$stamp.sql ($(du -h "$BACKUP_DIR/registry-$stamp.sql" | cut -f1))"

echo
echo "== migrate =="
# scripts/migrate-deploy.mts, not drizzle-kit migrate: the CLI exits 1 with no
# message when a Neon connection fails, which is indistinguishable from a
# broken migration. This one prints the error.
( cd "$HERE" && DATABASE_URL="$TARGET_URL" npx tsx scripts/migrate-deploy.mts )
now=$(psql "$TARGET_URL" -tAc 'select count(*) from drizzle.__drizzle_migrations')
ok "migrations applied: $applied -> $now"

echo
echo "== import =="
SOURCE_URL="$SOURCE_URL" TARGET_URL="$TARGET_URL" "$HERE/scripts/import-registry.sh"

echo
echo "== verify =="
for t in developers projects permits permit_files; do
  s=$(psql "$SOURCE_URL" -tAc "select count(*) from $t")
  d=$(psql "$TARGET_URL" -tAc "select count(*) from $t")
  [ "$s" = "$d" ] && ok "$t $s = $d" || fail "$t $s != $d"
done

orphans=$(psql "$TARGET_URL" -tAc 'select count(*) from permit_files f left join permits p on p.id=f.permit_id where p.id is null')
[ "$orphans" = "0" ] && ok "no orphaned QR files" || fail "$orphans orphaned QR files"

# Sequences must sit past the imported ids or the next issued permit collides.
for t in developers projects permits permit_files; do
  last=$(psql "$TARGET_URL" -tAc "select last_value from ${t}_id_seq")
  max=$(psql "$TARGET_URL" -tAc "select coalesce(max(id),0) from $t")
  [ "$last" -ge "$max" ] && ok "$t sequence at $last (max id $max)" || fail "$t sequence $last is behind max id $max"
done

echo "  existing data untouched:"
for t in users bookings deliverables general_permits review_decisions; do
  printf '    %-18s %s\n' "$t" "$(psql "$TARGET_URL" -tAc "select count(*) from $t")"
done

echo "  permit roles granted:"
psql "$TARGET_URL" -tAc "select '    '||email||' -> '||array_to_string(roles,',') from users where roles && array['agent','marketing','permit_admin']::user_role[] order by email"

# The whole reason ids were preserved: a QR url must still resolve.
sample=$(psql "$TARGET_URL" -tAc 'select url from permit_files limit 1')
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$sample")
[ "$code" = "200" ] && ok "sampled QR file returns 200" || fail "sampled QR file returned $code — check the blob store"

echo
echo "registry is live in the database. Deploy the merged branch next."
echo "Until it is deployed, none of this is visible to anyone."
