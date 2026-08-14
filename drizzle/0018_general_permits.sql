-- General media permits: codes covering routine company content (HR videos,
-- activations, social posts) rather than a single client project. Deliverables
-- logged under one of these are routed away from team leads, so only managers
-- review them; managers keep seeing everything.
--
-- `code` is digits only. Permits are free text and the same permit reaches us
-- spelled several ways — "0275066700", "PERMIT NUMBER 0275066700",
-- "General HR Video permit : 0977435990" — so both sides are reduced to digits
-- before comparing. The CHECK keeps a blank/!digit code out: it would otherwise
-- match every permit with no digits at all ("N/A", "No permit - Omar Essam").
CREATE TABLE "general_permits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "general_permits_code_unique" UNIQUE("code"),
	CONSTRAINT "general_permits_code_digits" CHECK ("code" ~ '^[0-9]+$')
);--> statement-breakpoint
ALTER TABLE "general_permits" ADD CONSTRAINT "general_permits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Seeded from how creators already labelled these codes in existing
-- deliverables; the manager edits the list at /admin/permits.
INSERT INTO "general_permits" ("code", "label") VALUES
	('2078525513', 'Company meetings & activations'),
	('1936438010', 'General info / social media posts'),
	('2113748196', 'General QR code'),
	('0977435990', 'General HR video permit')
ON CONFLICT ("code") DO NOTHING;
