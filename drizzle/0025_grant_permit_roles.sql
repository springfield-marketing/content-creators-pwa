-- Grants the permit roles to the people who already held them in the registry.
--
-- Separate from 0024 on purpose: Postgres forbids USING an enum value in the
-- transaction that added it, and 0024 is where agent/marketing/permit_admin
-- were added to user_role.
--
-- Only four rows. Everyone else arrives without a migration:
--   - creators read permits through the `creator` role they already hold, which
--     the capability table grants viewPermitDetails and viewQr (see
--     src/lib/registry/access.ts). No grant needed, which is why the nine of
--     them are absent below.
--   - booking agents provision themselves as {agent} on first sign-in.
--
-- Roles are APPENDED, never replaced — these people keep their content-ops
-- roles. Eloisa and Nihaal end up {manager,agent}: they manage the content team
-- and are only agents against the registry, which is precisely why permit
-- rights are granted here rather than inferred from `manager`.
--
-- Guarded so a re-run cannot double-append.

-- Registry admins: issue permits, batch renew, see every request.
UPDATE "users"
SET "roles" = array_append("roles", 'permit_admin'::"public"."user_role")
WHERE "email" IN ('zed@springfield-re.com', 'admin@springfield-re.com')
  AND NOT ('permit_admin' = ANY("roles"));--> statement-breakpoint

-- Registry agents: request permits and follow their own, no permit numbers and
-- no QR images.
UPDATE "users"
SET "roles" = array_append("roles", 'agent'::"public"."user_role")
WHERE "email" IN ('eloisa@springfield-re.com', 'nihaal@springfield-re.com')
  AND NOT ('agent' = ANY("roles"));

-- NOT GRANTED: marketing@springfield-re.com, an admin in the registry with no
-- account in this app. Deliberately left out rather than created here — adding
-- a sign-in account is a decision for a human, not a side effect of a data
-- migration. If that mailbox still issues permits, add the user through
-- /admin/team and grant permit_admin.
