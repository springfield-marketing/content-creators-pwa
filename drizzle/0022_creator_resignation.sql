-- Resigning a creator, as distinct from simply hiding them.
--
-- Content creators share a pool of mailboxes (media@, media1@ …): when someone
-- leaves, the next hire takes over their address. users.email is UNIQUE, so the
-- leaver's row has to release it or the replacement can't be created — and
-- renaming the old row instead would hand the newcomer the leaver's history
-- (47 bookings and 14 deliverables, in Jericho's case) under 13 foreign keys.
--
-- So resigning frees the address and keeps the person: former_email records
-- what they held, resigned_on when they went, and every booking, deliverable
-- and review decision stays attached to the original row.
ALTER TABLE "users" ADD COLUMN "resigned_on" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "former_email" text;
