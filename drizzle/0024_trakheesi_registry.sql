-- Trakheesi registry: advertising permits for Springfield offplan projects,
-- merged in from the standalone Trakheesi Registry app so creators can look up
-- the permit for what they are shooting and agents can request one.
--
-- Distinct from "general_permits", which stays exactly as it is. Those are
-- company-content codes that decide WHO REVIEWS a deliverable. These are
-- per-project DLD permits that decide WHETHER A PROJECT MAY BE MARKETED.
-- Two different things that share a word; the tables never mix.
--
-- Integer keys are carried over from the source app rather than converted to
-- uuid. Nothing outside this block references them, and preserving the ids is
-- what lets the 1,523 migrated QR file rows keep pointing at the right permits.

-- Three roles arrive with the registry. They describe a different axis from the
-- content-ops roles: what someone may do with permits, not what they do in the
-- content team. Deliberately NOT implied by 'manager' — the two systems
-- disagreed about the same people (Eloisa and Nihaal manage content but are
-- only agents against the registry), so permit rights are granted per person.
--
-- ADD VALUE rather than the type-swap dance of 0011: Postgres only forbids
-- USING a new enum value in the transaction that added it, and nothing here
-- uses them. The grants land in their own migration, after this one commits.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'agent';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'marketing';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'permit_admin';--> statement-breakpoint

CREATE TYPE "public"."dld_status" AS ENUM('active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'in_progress', 'issued', 'rejected');--> statement-breakpoint

CREATE TABLE "developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developers_name_en_unique" UNIQUE("name_en")
);--> statement-breakpoint

-- dld_project_number is nullable and UNIQUE: developer-level permits cover no
-- single project (e.g. "Aldar General QR Code"). Postgres allows many nulls
-- under a unique constraint, so those rows coexist fine.
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"dld_project_number" text,
	"name_en" text NOT NULL,
	"developer_id" integer REFERENCES "public"."developers"("id"),
	"emirate" text,
	"dld_status" "public"."dld_status",
	"wp_post_id" integer,
	"drive_folder_id" text,
	"drive_archive_folder_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_dld_project_number_unique" UNIQUE("dld_project_number")
);--> statement-breakpoint

-- One row per issuance. Renewing inserts a new row rather than updating the old
-- one, so the history of what was valid when is preserved.
--
-- listing_start/listing_end are `date`, not timestamp: a listing window is
-- calendar days, and a timezone would only introduce off-by-one errors at
-- expiry — the exact drift the source spreadsheet suffered from.
CREATE TABLE "permits" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL REFERENCES "public"."projects"("id"),
	"permit_number" text NOT NULL,
	"listing_start" date NOT NULL,
	"listing_end" date NOT NULL,
	"qr_url" text,
	"qr_drive_id" text,
	"permit_pdf_url" text,
	"permit_pdf_drive_id" text,
	"issued_by_email" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- DLD issues four QR sizes per permit — original, facebook, instagram, twitter
-- — so a single url column on "permits" could never hold them. The unique
-- constraint on (permit, variant) is what makes re-import idempotent.
CREATE TABLE "permit_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_id" integer NOT NULL REFERENCES "public"."permits"("id") ON DELETE cascade,
	"variant" text NOT NULL,
	"file_name" text NOT NULL,
	"url" text NOT NULL,
	"drive_id" text,
	"drive_archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permit_files_permit_variant" UNIQUE("permit_id","variant")
);--> statement-breakpoint

-- requested_by_email rather than a users FK: the requester is often an agent
-- whose users row is created on first sign-in, and the registry has always
-- keyed requests on address.
CREATE TABLE "permit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer REFERENCES "public"."projects"("id"),
	"requested_project_name" text,
	"requested_by_email" text NOT NULL,
	"note" text,
	"status" "public"."request_status" DEFAULT 'new' NOT NULL,
	"permit_id" integer REFERENCES "public"."permits"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);--> statement-breakpoint

-- The project list is searched by name on every page load, and the permit
-- lookup always wants the latest issuance for a project.
CREATE INDEX "projects_name" ON "projects" ("name_en");--> statement-breakpoint
CREATE INDEX "permits_project_end" ON "permits" ("project_id","listing_end" DESC);--> statement-breakpoint
CREATE INDEX "permit_requests_status" ON "permit_requests" ("status","created_at" DESC);
