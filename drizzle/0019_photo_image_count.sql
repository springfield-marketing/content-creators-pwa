-- Photo output measured in images, not folders.
--
-- The log form submits a photo shoot as a single folder link, so counting
-- deliverables values one photo shoot (which may hold 200 images) the same as
-- one video clip — and videos average 2.08 deliverables per shoot against
-- photo's 1.00. image_count records what the folder actually contains, so photo
-- volume is measurable without inventing an exchange rate against video.
--
-- Nullable: every photo deliverable logged before this migration has no count,
-- and back-filling would mean guessing. New ones are required at the API.
ALTER TABLE "deliverables" ADD COLUMN "image_count" integer;--> statement-breakpoint
-- Photo is scored against its own target rather than the shared deliverables
-- one, so a photographer is never ranked on a number built for clip counts.
ALTER TABLE "kpi_targets" ADD COLUMN "target_images" integer DEFAULT 0;
