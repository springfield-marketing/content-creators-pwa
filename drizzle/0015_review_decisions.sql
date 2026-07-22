-- Review log (removable feature): a domain-modelled record of every review
-- decision, for reviewer accountability and feedback analysis. Backfills from
-- the audit log so history is present from the start. Drop this table to
-- remove the feature.
CREATE TABLE "review_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deliverable_id" uuid NOT NULL REFERENCES "deliverables"("id"),
  "creator_id" uuid NOT NULL REFERENCES "users"("id"),
  "reviewer_id" uuid REFERENCES "users"("id"),
  "decision" text NOT NULL,
  "comment" text,
  "permit_number" text,
  "decided_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "review_decisions_decision" CHECK ("decision" in ('approved','changes_requested'))
);--> statement-breakpoint
CREATE INDEX "review_decisions_reviewer" ON "review_decisions" ("reviewer_id","decided_at");--> statement-breakpoint
CREATE INDEX "review_decisions_creator" ON "review_decisions" ("creator_id","decided_at");--> statement-breakpoint
INSERT INTO "review_decisions"
  (deliverable_id, creator_id, reviewer_id, decision, comment, permit_number, decided_at)
SELECT al.entity_id, al.subject_creator_id, al.actor_id,
       CASE al.action WHEN 'approve' THEN 'approved' ELSE 'changes_requested' END,
       al.diff->>'comment', al.diff->>'permitNumber', al.created_at
FROM "audit_log" al
WHERE al.entity = 'deliverable'
  AND al.action IN ('approve','request_changes')
  AND al.subject_creator_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM "deliverables" d WHERE d.id = al.entity_id);
