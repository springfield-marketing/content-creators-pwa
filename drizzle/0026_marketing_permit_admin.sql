-- marketing@springfield-re.com, the one registry admin with no account here.
--
-- 0025 deliberately left this out: creating a sign-in account is a decision for
-- a human, not a side effect of a data migration. That decision has now been
-- made, so it lands as a migration rather than a one-off UPDATE typed at a
-- production console — a fresh environment should end up with the same people.
--
-- {permit_admin} only. It is a registry account: it issues permits, batch
-- renews and works the request queue, and has no business in the content-ops
-- screens. homeFor() therefore lands it on /permits, which is the whole of its
-- job. Adding a content-ops role later is a grant, not a rewrite.
--
-- full_name is NOT NULL. This is a shared mailbox rather than a person, so the
-- name says what it is.
--
-- ON CONFLICT DO NOTHING: if the address has since signed in and been
-- auto-provisioned as {agent}, this migration must not quietly downgrade or
-- duplicate it — the grant below fixes that case instead.
INSERT INTO "users" ("email", "full_name", "roles")
VALUES ('marketing@springfield-re.com', 'Marketing', ARRAY['permit_admin']::"public"."user_role"[])
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint

-- Covers the race above: the row existed already because someone signed in
-- before this ran, so it holds {agent} and needs promoting.
UPDATE "users"
SET "roles" = array_append("roles", 'permit_admin'::"public"."user_role")
WHERE "email" = 'marketing@springfield-re.com'
  AND NOT ('permit_admin' = ANY("roles"));
