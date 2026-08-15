-- Which craft a creator is measured on. Photo and video aren't the same unit
-- of work — a photo shoot is one folder link, a video shoot averages 2.08
-- clips — so they can't share a target. Until now every creator carried the
-- same 75-deliverable target, which left the photographer near 19% attainment
-- permanently: the wrong yardstick, not underperformance.
--
-- 'both' is a real case, not a hedge: Yves has 11 photo deliverables (second
-- only to Charles) alongside 46 video. A creator marked 'both' gets a target
-- in each discipline and their leaderboard attainment averages the two, so
-- neither half can carry the other.
CREATE TYPE "public"."creator_craft" AS ENUM('video', 'photo', 'both');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "craft" "creator_craft" DEFAULT 'video' NOT NULL;--> statement-breakpoint
-- Seeded from actual output share; the manager adjusts on /admin/creators.
-- Charles is 93% photo, Yves 19% photo but at real volume.
UPDATE "users" SET "craft" = 'photo' WHERE "slug" = 'charles-bonifacio';--> statement-breakpoint
UPDATE "users" SET "craft" = 'both' WHERE "slug" = 'yves-rom-dignadice';
