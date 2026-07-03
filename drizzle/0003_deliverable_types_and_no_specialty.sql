-- All creators shoot both photo and video — specialty is meaningless.
ALTER TABLE users DROP COLUMN IF EXISTS specialty;

-- Deliverable types simplified to Photo Shoot / Video Shoot (reel removed).
-- Postgres can't drop enum values, so recreate the type and remap existing rows.
ALTER TABLE deliverables ALTER COLUMN type TYPE text;
DROP TYPE deliverable_type;
CREATE TYPE deliverable_type AS ENUM ('photo_shoot', 'video_shoot', 'other');
UPDATE deliverables SET type = CASE type
  WHEN 'photo_set' THEN 'photo_shoot'
  WHEN 'reel'      THEN 'video_shoot'
  WHEN 'video'     THEN 'video_shoot'
  ELSE 'other'
END;
ALTER TABLE deliverables ALTER COLUMN type TYPE deliverable_type USING type::deliverable_type;
