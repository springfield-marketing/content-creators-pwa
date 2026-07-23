-- A creator-supplied title for deliverables not tied to a shoot, so they're
-- identifiable in the review queue. Additive + nullable.
ALTER TABLE "deliverables" ADD COLUMN "title" text;
