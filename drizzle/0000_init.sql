CREATE TYPE "public"."booking_source" AS ENUM('agent', 'company', 'manual');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."deliverable_type" AS ENUM('reel', 'photo_set', 'video', 'other');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('instagram', 'tiktok', 'drive', 'dropbox', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('submitted', 'under_review', 'approved', 'needs_revision');--> statement-breakpoint
CREATE TYPE "public"."shoot_location" AS ENUM('on_site', 'office');--> statement-breakpoint
CREATE TYPE "public"."shoot_type" AS ENUM('photo', 'video', 'photo_video');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('creator', 'manager', 'executive');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"office" text,
	"is_approved" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "agents_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"agent_id" uuid,
	"source" "booking_source" DEFAULT 'agent' NOT NULL,
	"shoot_type" "shoot_type" NOT NULL,
	"location_type" "shoot_location" NOT NULL,
	"property_address" text,
	"notes" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"cancellation_reason" text,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"manage_token_hash" text,
	"google_event_id" text,
	"google_calendar_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bookings_google_event_id_unique" UNIQUE("google_event_id")
);
--> statement-breakpoint
CREATE TABLE "creator_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"booking_id" uuid,
	"agent_id" uuid,
	"type" "deliverable_type" NOT NULL,
	"platform" "platform",
	"url" text NOT NULL,
	"is_posted" boolean DEFAULT false,
	"posted_at" timestamp with time zone,
	"work_date" date NOT NULL,
	"review_status" "review_status" DEFAULT 'submitted' NOT NULL,
	"review_comment" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"month" date NOT NULL,
	"shoots_completed" integer,
	"shoots_cancelled" integer,
	"deliverables_total" integer,
	"deliverables_approved" integer,
	"posted_total" integer,
	"avg_turnaround_hours" numeric
);
--> statement-breakpoint
CREATE TABLE "kpi_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"month" date NOT NULL,
	"target_shoots" integer DEFAULT 0,
	"target_deliverables" integer DEFAULT 0,
	"target_posted" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"slug" text,
	"google_calendar_id" text,
	"google_refresh_token" text,
	"webhook_channel_id" text,
	"webhook_resource_id" text,
	"webhook_expires_at" timestamp with time zone,
	"calendar_sync_token" text,
	"working_hours" jsonb DEFAULT '{"mon":[["09:00","18:00"]],"tue":[["09:00","18:00"]],"wed":[["09:00","18:00"]],"thu":[["09:00","18:00"]],"fri":[["09:00","18:00"]]}'::jsonb,
	"shoot_durations" jsonb DEFAULT '{"photo":90,"video":150,"photo_video":180}'::jsonb,
	"buffer_minutes" integer DEFAULT 30,
	"min_notice_hours" integer DEFAULT 24,
	"max_horizon_days" integer DEFAULT 28,
	"max_shoots_per_day" integer DEFAULT 3,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_time_off" ADD CONSTRAINT "creator_time_off_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_time_off" ADD CONSTRAINT "creator_time_off_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_creator_time" ON "bookings" USING btree ("creator_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "time_off_creator" ON "creator_time_off" USING btree ("creator_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "deliverables_review" ON "deliverables" USING btree ("review_status","created_at");--> statement-breakpoint
CREATE INDEX "deliverables_creator_month" ON "deliverables" USING btree ("creator_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_snapshots_creator_date" ON "kpi_snapshots" USING btree ("creator_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_targets_creator_month" ON "kpi_targets" USING btree ("creator_id","month");