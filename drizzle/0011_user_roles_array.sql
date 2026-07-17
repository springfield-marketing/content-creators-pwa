-- users.role (single enum) -> users.roles (enum array), plus the team_lead role.
-- One person can now hold several roles: Ahmed is {creator,team_lead} — he keeps
-- every creator code path (bookable, weekly plan, KPIs) and gains the review screen.
--
-- Built as a new type + rename rather than ALTER TYPE ... ADD VALUE: Postgres
-- forbids using a newly added enum value in the transaction that added it, and
-- the migration runner's transaction boundaries aren't ours to assume.
CREATE TYPE "public"."user_role_new" AS ENUM('creator', 'team_lead', 'manager', 'executive');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "roles" "user_role_new"[];--> statement-breakpoint
UPDATE "users" SET "roles" = ARRAY["role"::text::"user_role_new"];--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "roles" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
ALTER TYPE "public"."user_role_new" RENAME TO "user_role";--> statement-breakpoint
-- A user with no roles could sign in but reach nothing; fail loudly instead.
-- cardinality, not array_length: array_length('{}',1) is NULL, and a CHECK
-- passes on NULL — so the array_length form would let empty roles straight through.
ALTER TABLE "users" ADD CONSTRAINT "users_roles_not_empty" CHECK (cardinality("roles") >= 1);
