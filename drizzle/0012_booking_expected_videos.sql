-- Partial video deliverables: a shoot can yield several videos submitted over
-- multiple days. The creator declares the total on their first video submit;
-- outstanding = expected_videos − count of video deliverables for the booking.
-- Additive + nullable, so it's backward-compatible with the running code.
ALTER TABLE "bookings" ADD COLUMN "expected_videos" integer;
