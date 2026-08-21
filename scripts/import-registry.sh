#!/usr/bin/env bash
#
# Copies the Trakheesi registry out of the standalone app's database into this
# one: developers, projects, permits and the QR files that hang off them.
#
# Ids are preserved, not regenerated. permit_files.permit_id points at
# permits.id, and the 1,523 QR rows are only correct if those integers survive
# the move — so this is a straight data copy, never an insert-and-remap.
#
# Re-runnable. Every run truncates the five tables first, so a failed cutover
# can simply be run again rather than unpicked. It refuses to touch a target
# that already has permit requests, since those are real user submissions this
# script has no copy of.
#
#   SOURCE_URL=postgres://…  TARGET_URL=postgres://…  scripts/import-registry.sh
#
# users are NOT copied. They already exist in this app; permit roles are
# granted separately, per person.

set -euo pipefail

: "${SOURCE_URL:?set SOURCE_URL to the registry database}"
: "${TARGET_URL:?set TARGET_URL to the booking app database}"

# FK order. permit_files depends on permits depends on projects depends on
# developers, and pg_dump given several -t flags emits them alphabetically —
# which is exactly the wrong order — so each table is dumped on its own.
TABLES=(developers projects permits permit_files)

echo "source: $(psql "$SOURCE_URL" -tAc 'select current_database()')"
echo "target: $(psql "$TARGET_URL" -tAc 'select current_database()')"

requests=$(psql "$TARGET_URL" -tAc 'select count(*) from permit_requests')
if [ "$requests" != "0" ]; then
  echo "refusing to run: target has $requests permit request(s) this script cannot recreate." >&2
  exit 1
fi

echo
echo "== source counts =="
for t in "${TABLES[@]}"; do
  printf '  %-14s %s\n' "$t" "$(psql "$SOURCE_URL" -tAc "select count(*) from $t")"
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

for t in "${TABLES[@]}"; do
  pg_dump "$SOURCE_URL" --data-only --no-owner --no-acl -t "public.$t" \
    >"$work/$t.sql"
done

# One transaction: a partial registry is worse than none, and CASCADE keeps the
# truncate honest about permit_files hanging off permits.
{
  echo "BEGIN;"
  echo "TRUNCATE developers, projects, permits, permit_files, permit_requests RESTART IDENTITY CASCADE;"
  for t in "${TABLES[@]}"; do cat "$work/$t.sql"; done
  # Sequences restart at 1 after TRUNCATE … RESTART IDENTITY, and the copied
  # rows carry explicit ids — so without this the next issued permit collides
  # with permit 1.
  for t in "${TABLES[@]}"; do
    echo "SELECT setval(pg_get_serial_sequence('public.$t','id'), COALESCE((SELECT MAX(id) FROM public.$t), 1), (SELECT COUNT(*) > 0 FROM public.$t));"
  done
  echo "COMMIT;"
} >"$work/import.sql"

psql "$TARGET_URL" -q -v ON_ERROR_STOP=1 -f "$work/import.sql" >/dev/null

echo
echo "== target counts =="
fail=0
for t in "${TABLES[@]}"; do
  src=$(psql "$SOURCE_URL" -tAc "select count(*) from $t")
  dst=$(psql "$TARGET_URL" -tAc "select count(*) from $t")
  if [ "$src" = "$dst" ]; then mark="ok"; else mark="MISMATCH"; fail=1; fi
  printf '  %-14s %s -> %s  %s\n' "$t" "$src" "$dst" "$mark"
done

# The whole point of preserving ids: every QR file must still resolve to the
# permit it was issued under.
orphans=$(psql "$TARGET_URL" -tAc \
  'select count(*) from permit_files f left join permits p on p.id = f.permit_id where p.id is null')
echo "  orphaned QR files: $orphans"
[ "$orphans" = "0" ] || fail=1

echo
[ "$fail" = "0" ] && echo "registry imported." || { echo "IMPORT FAILED" >&2; exit 1; }
