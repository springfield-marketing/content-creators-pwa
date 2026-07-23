-- Allow short-notice (same-day) bookings: drop the minimum notice from 24h to
-- 3h, for existing creators and as the new default. Managers can still tune it
-- per creator in /admin/creators.
ALTER TABLE "users" ALTER COLUMN "min_notice_hours" SET DEFAULT 3;--> statement-breakpoint
UPDATE "users" SET "min_notice_hours" = 3 WHERE 'creator' = ANY("roles");
