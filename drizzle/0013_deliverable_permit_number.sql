-- Reviewers record the video's permit number when approving, so the
-- verification is captured on the deliverable. Additive + nullable —
-- backward-compatible with the running code.
ALTER TABLE "deliverables" ADD COLUMN "permit_number" text;
