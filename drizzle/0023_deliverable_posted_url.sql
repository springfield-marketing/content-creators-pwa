-- Where the work actually went live.
--
-- deliverables.url is what the creator delivered — 327 of 350 posted ones point
-- at a Drive or Dropbox file, so nothing recorded the published post itself.
-- Marking something posted set a flag and a timestamp and captured no link.
--
-- Nullable, and deliberately not backfilled: the 350 already posted would need
-- someone to go and find each link. Required at the API from here on, so
-- everything marked posted from now carries one.
ALTER TABLE "deliverables" ADD COLUMN "posted_url" text;
