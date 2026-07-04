CREATE TYPE "public"."week_role" AS ENUM('all', 'photo_only', 'video_only', 'company_only');--> statement-breakpoint
CREATE TABLE "creator_week_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"role" "week_role" DEFAULT 'all' NOT NULL,
	"working_hours" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "max_horizon_days" SET DEFAULT 7;--> statement-breakpoint
ALTER TABLE "creator_week_schedules" ADD CONSTRAINT "creator_week_schedules_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_week_schedules" ADD CONSTRAINT "creator_week_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "week_schedule_creator_week" ON "creator_week_schedules" USING btree ("creator_id","week_start");