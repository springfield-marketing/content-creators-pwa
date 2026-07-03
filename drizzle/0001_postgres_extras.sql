-- Postgres features Drizzle's schema DSL can't express (§B4).

-- Trigram search for agent autocomplete
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX agents_name_trgm ON agents USING gin (full_name gin_trgm_ops);

-- Strict double-booking prevention: no two confirmed bookings for the same
-- creator may overlap in time. Final backstop against race conditions.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_confirmed
  EXCLUDE USING gist (
    creator_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed');
