-- Media permits are issued with a validity period, so the list needs to show
-- which ones are lapsing. Nullable: some codes have no stated expiry, and the
-- eight already in use were added without one.
--
-- Deliberately informational. Routing still keys on is_active alone, so an
-- expired code keeps sending its work to managers until someone switches it
-- off — a date passing shouldn't silently hand a team lead work they weren't
-- reviewing yesterday.
ALTER TABLE "general_permits" ADD COLUMN "expires_on" date;
