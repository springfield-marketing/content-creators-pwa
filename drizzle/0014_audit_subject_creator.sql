-- Activity timeline: record which creator each audit event is about, so a
-- per-creator (and global) history can be queried without runtime joins.
-- Additive + nullable, backward-compatible. Backfills existing rows from the
-- booking/deliverable each event points at.
ALTER TABLE "audit_log" ADD COLUMN "subject_creator_id" uuid;--> statement-breakpoint
UPDATE "audit_log" a SET "subject_creator_id" = b.creator_id
  FROM "bookings" b WHERE a.entity = 'booking' AND a.entity_id = b.id;--> statement-breakpoint
UPDATE "audit_log" a SET "subject_creator_id" = d.creator_id
  FROM "deliverables" d WHERE a.entity = 'deliverable' AND a.entity_id = d.id;--> statement-breakpoint
CREATE INDEX "audit_subject_created" ON "audit_log" ("subject_creator_id", "created_at");
