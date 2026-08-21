# Deploying

Vercel project **content-creators-pwa** → <https://booking.springfieldproperties.ae>
(team `springfield-marketing`, scope `nihaals-projects-dff64ce5`).

Deploys are driven by git. `main` builds to production; any other branch builds
a preview. There is no manual `vercel deploy` step in the normal flow.

## The normal flow

```bash
git push -u origin <branch>     # -> preview build, same database as production
# check the preview URL
gh pr create --fill             # or merge straight to main
# merging to main -> production build
```

## Migrations run themselves

`vercel.json` sets:

```json
"buildCommand": "npm run db:migrate:deploy && next build"
```

so a schema change ships with the code that needs it instead of being a step
someone has to remember. If a migration fails the build fails, and no code is
deployed against a schema that cannot support it.

`scripts/migrate-deploy.mts`:

- **skips on preview builds** — `DATABASE_URL` is shared across environments, so
  a preview would otherwise migrate production;
- **prefers `DATABASE_URL_UNPOOLED`** and strips `-pooler.` from whatever it
  gets (see the pooler warning below);
- **prints the target host** so a mistake is visible in the build log;
- **only reads `.env` when `DATABASE_URL` is unset** — `.env` holds the LOCAL
  database, and silently migrating localhost while believing it was production
  is the one mistake it must not allow.

To run a migration by hand against production:

```bash
DATABASE_URL="$(grep '^NEON_DATABASE_URL=' .env | cut -d= -f2-)" \
  npm run db:migrate:deploy
```

## Never use `drizzle-kit migrate` against Neon

It exits `1` with **no message at all** when it cannot connect or a statement
fails, which is indistinguishable from a broken migration. Use
`npm run db:migrate:deploy`, which prints the failing statement.

`drizzle-kit generate` is also unusable here — see the migrations note in
CLAUDE.md. Migrations are hand-written.

## Never point admin tooling at Neon's pooler

Neon's pooler returns server connections **without resetting `search_path`**,
and `pg_dump` sets it to empty for its session. Back up and then query in the
same script and the second connection can inherit the empty path, so every
unqualified query fails with `relation "users" does not exist` against a
database that is perfectly healthy. This turned the first production cutover
into a fake failure.

`PGOPTIONS=-c search_path=public` does not fix it — the pooler rejects
`options=` in the startup packet and tells you to use an unpooled connection.

So: **strip `-pooler.` from the host for migrations, dumps and admin scripts.**
`scripts/cutover.sh` and `scripts/import-registry.sh` both do this via
`unpooled()`. The app itself should keep using the pooled URL.

## Environment

Set for Production + Preview on the project. Check with `vercel env ls production`.

| Variable | Purpose | Status |
|---|---|---|
| `DATABASE_URL` | Neon, pooled — the app | set |
| `DATABASE_URL_UNPOOLED` | Neon, direct — build migrations | set |
| `AUTH_SECRET`, `AUTH_URL` | Auth.js | set |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google sign-in | set |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Calendar delegation | set |
| `CRON_SECRET` | Guards all four crons | set |
| `RESEND_API_KEY`, `MAIL_FROM` | Permit expiry email | **NOT SET** |
| `BLOB_READ_WRITE_TOKEN` | QR uploads | **NOT SET** (see below) |

Without `RESEND_API_KEY` the expiry cron still runs and reports; it just sends
nothing and says `email not configured`. `src/lib/email.ts` (booking mail) is a
separate console-log stub and is unaffected either way.

## Blob storage — the one genuinely irreversible thing

Two stores exist on the team:

| Store | ID | Contents |
|---|---|---|
| `project-tracker-blob` | `store_V2wbfk4MWfbidj1O` | **the 1,523 permit QR images**, 32MB |
| `content-creators-pwa-blob` | `store_ZWys1LfS1Ks4zw70` | empty |

Every `permit_files.url` points at
`v2wbfk4mwfbidj1o.public.blob.vercel-storage.com` — the store id is baked into
1,523 rows, so **that store can never be renamed or deleted**, and the URLs
resolve from it whether or not any project is connected.

`project-tracker-blob` is connected to **both** projects (done 21 Aug 2026), so
new QR uploads can reach it. There is no CLI command for connecting a store;
it is Vercel dashboard → Storage → Connect Project.

**Both stores being connected is why `src/lib/registry/storage.ts` pins
`storeId` explicitly.** Under OIDC the SDK resolves the store from
`BLOB_STORE_ID`, which names *this app's own* store — so without pinning, QR
codes issued from here would land in a different store from the 1,523 issued
before, and `content-creators-pwa-blob` would quietly stop being empty. Anyone
later deleting it as unused would destroy live permits.

Connecting the store created `BLOB_STORE_ID_BOOKING_STORE_ID`. `storage.ts`
reads that, with `PERMIT_BLOB_STORE_ID` as an override if the generated name
ever changes.

## Crons

Four, all guarded by `CRON_SECRET`. `permit-expiry` fails *closed* if the secret
is unset; the three older ones skip the check instead.

| Path | Schedule (UTC) |
|---|---|
| `/api/cron/complete-past-bookings` | `0 17 * * *` |
| `/api/cron/kpi-snapshot` | `30 20 * * *` |
| `/api/cron/renew-watch-channels` | `0 3 * * *` |
| `/api/cron/permit-expiry` | `0 4 * * *` |

## Rolling back

Code: revert the commit and push, or promote a previous deployment in the
dashboard. Schema: migrations are forward-only — write a new one.

Database backups from the registry cutover are in `../cutover-backups/`
(outside the repo, not committed).
