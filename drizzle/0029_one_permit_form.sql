-- One add form for every permit, so the shape rules stop demanding a field the
-- form no longer asks for.
--
-- Both kinds are Trakheesi permits and a person adding one sets out to do the
-- same thing either way, so the two forms became one: permit number, emirate,
-- what it covers, expiry, notes, QR images, and — where there is one — a DLD
-- project number and developer.
--
-- The listing START went with the split. Nothing ever read it: status,
-- ordering and expiry all key on listing_end alone, and it was only ever there
-- to derive a default end date the form now asks for directly. The column and
-- its existing values stay; it is simply no longer required.
--
-- What did NOT merge is `category`. It decides who reviews a deliverable
-- logged under the permit — 81 of them currently route to a manager rather
-- than a team lead — and 33 offplan permit numbers also appear on
-- deliverables, so blurring the two would silently hide that work as well.
-- The form carries an explicit switch for it instead of guessing from whether
-- a project was named: developer-level permits genuinely have no DLD number,
-- and deriving it would flip those to general and hijack their routing.
ALTER TABLE "permits" DROP CONSTRAINT "permits_offplan_shape";--> statement-breakpoint

ALTER TABLE "permits" ADD CONSTRAINT "permits_offplan_shape" CHECK (
  "category" <> 'offplan' OR ("project_id" IS NOT NULL AND "listing_end" IS NOT NULL)
);
