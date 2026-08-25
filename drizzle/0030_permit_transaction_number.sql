-- The DLD transaction number the permit was issued against.
--
-- Optional, and free text rather than digits-constrained: it is a reference
-- copied off the paperwork, not something this app matches on. Permit numbers
-- are constrained because review routing compares them; nothing compares this.
--
-- No backfill. The 410 existing permits were migrated from a sheet that never
-- carried one, and inventing a value would be worse than an honest blank.
ALTER TABLE "permits" ADD COLUMN "transaction_number" text;
