# Deploying to Vercel

## 1. Get the code to Vercel
Preferred: connect the GitHub repo (`springfield-marketing/content-creators-pwa`)
in Vercel → auto-deploy on push. (Requires the local git push to work.)
Alternative without GitHub: `npx vercel` from the project root (CLI deploy).

## 2. Database — Neon via Vercel Marketplace
Vercel dashboard → Storage → Create → Neon (free tier). Attach to the project;
it injects `DATABASE_URL`. Copy that URL for the next step.

## 3. Migrate + seed the hosted database (run locally)
```bash
DATABASE_URL='<neon-url>' npx drizzle-kit migrate
SEED_DEMO=0 DATABASE_URL='<neon-url>' npx tsx src/db/seed.ts
```
(The seed reads `seed-data/creators.local.json` and `Agent list.csv` from this
machine — real people land in the hosted DB without ever touching git.)

## 4. Environment variables (Vercel → Project → Settings → Environment Variables)
| Var | Value |
|---|---|
| `AUTH_SECRET` | fresh `openssl rand -base64 32` |
| `AUTH_URL` | `https://<your-app>.vercel.app` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | same OAuth client as dev |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `base64 -i google-service-account.local.json` output |
| `CRON_SECRET` | fresh `openssl rand -hex 24` |

## 5. Google OAuth redirect
Google Cloud Console → Credentials → the OAuth client → add redirect URI:
`https://<your-app>.vercel.app/api/auth/callback/google`

## 6. Smoke test
Sign in as manager → plan the week in /admin/schedule → book at /book →
event lands in the creator's calendar → manage link works.

## 7. Webhooks (optional now; edits made directly in Google Calendar sync back)
1. Verify the domain in Google Search Console (required by Calendar push).
2. Set `APP_URL=https://<your-app>.vercel.app` and `WEBHOOK_CHANNEL_TOKEN`
   (fresh `openssl rand -hex 24`) in Vercel env, redeploy.
3. Trigger once: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<app>/api/cron/renew-watch-channels`
   — the daily cron keeps channels renewed after that.

## Notes
- Crons are configured in `vercel.json` (times are UTC: 17:00 = 21:00 Dubai
  completion sweep; 20:30 = 00:30 Dubai KPI snapshot).
- The email stub logs instead of sending until `RESEND_API_KEY` exists;
  Google Calendar invites are real regardless.
- Optional while internal-only: Vercel → Settings → Deployment Protection
  gates the whole site behind Vercel login (remember to disable before
  agents need public /book access).
