-- One permits table for every kind of permit.
--
-- general_permits was a second table that happened to share a word with the
-- offplan registry. Folding it in means one place to look, and a `category`
-- column that the next kind — secondary, and whatever follows — slots into
-- without another table.
--
-- The two things stay semantically distinct and the app keeps treating them so:
--   offplan — decides WHETHER A PROJECT MAY BE MARKETED
--   general — decides WHO REVIEWS a deliverable logged under it
-- Merging the storage is not merging the meaning.

-- category is text + CHECK, not a pgEnum, on purpose. Adding 'secondary' later
-- is then one migration that swaps this constraint. An enum would need the
-- type-swap 0024 was forced into: Postgres refuses to let a value added by
-- ALTER TYPE be used in the transaction that added it, and drizzle's migrator
-- runs every pending migration in a single transaction.
ALTER TABLE "permits" ADD COLUMN "category" text NOT NULL DEFAULT 'offplan';--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_category"
  CHECK ("category" IN ('offplan', 'general'));--> statement-breakpoint

ALTER TABLE "permits" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "permits" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;--> statement-breakpoint

-- A general permit covers no project and has no listing window, so the columns
-- that were NOT NULL for offplan cannot stay NOT NULL for the table.
ALTER TABLE "permits" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "permits" ALTER COLUMN "listing_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "permits" ALTER COLUMN "listing_end" DROP NOT NULL;--> statement-breakpoint

-- The invariants move from nullability to per-category CHECKs, so nothing is
-- actually loosened: an offplan permit still cannot exist without a project and
-- a window, it is just now stated where it is true.
ALTER TABLE "permits" ADD CONSTRAINT "permits_offplan_shape" CHECK (
  "category" <> 'offplan' OR (
    "project_id" IS NOT NULL AND "listing_start" IS NOT NULL AND "listing_end" IS NOT NULL
  )
);--> statement-breakpoint

-- Digits only, and a label, for the same reason general_permits had them: the
-- code is matched against free-text permit numbers on deliverables by reducing
-- both sides to digits, so a code with none ("N/A") would match everything.
ALTER TABLE "permits" ADD CONSTRAINT "permits_general_shape" CHECK (
  "category" <> 'general' OR (
    "project_id" IS NULL AND "label" IS NOT NULL AND "permit_number" ~ '^[0-9]+$'
  )
);--> statement-breakpoint

-- Offplan permits repeat by design — a renewal is a new row for the same
-- project. General codes do not: one row per code, which is what the old
-- general_permits.code UNIQUE gave us. Partial index keeps both true.
CREATE UNIQUE INDEX "permits_general_code" ON "permits" ("permit_number")
  WHERE "category" = 'general';--> statement-breakpoint

-- audit_log.entity_id was uuid, and permits are integer-keyed. Widening to text
-- rather than skipping the audit trail for permits; every existing uuid casts
-- cleanly and every caller already passes a string.
ALTER TABLE "audit_log" ALTER COLUMN "entity_id" TYPE text;--> statement-breakpoint

-- Move the codes across. expires_on becomes listing_end: it is the date the
-- permit stops being valid, which is what that column means. There is no start
-- date to carry, hence listing_start staying null.
--
-- created_by was a users FK; permits records issued_by_email instead, so it is
-- resolved here while general_permits still exists to join against.
INSERT INTO "permits" (
  "category", "permit_number", "label", "is_active",
  "listing_end", "issued_by_email", "notes", "created_at"
)
SELECT
  'general', gp."code", gp."label", gp."is_active",
  gp."expires_on", u."email", 'migrated from general_permits', gp."created_at"
FROM "general_permits" gp
LEFT JOIN "users" u ON u."id" = gp."created_by";--> statement-breakpoint

-- Past audit entries pointed at general_permits uuids. Repoint them at the new
-- permit rows so the history of who added or switched off a code survives.
UPDATE "audit_log" a
SET "entity" = 'permit', "entity_id" = p."id"::text
FROM "general_permits" gp
JOIN "permits" p ON p."category" = 'general' AND p."permit_number" = gp."code"
WHERE a."entity" = 'general_permit' AND a."entity_id" = gp."id"::text;--> statement-breakpoint

DROP TABLE "general_permits";
