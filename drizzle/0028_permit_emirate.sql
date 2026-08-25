-- Emirate on the permit, so the issuing authority can be worked out from it.
--
-- Dubai permits come from Trakheesi (DLD/RERA); Abu Dhabi permits come from
-- Madhmoun (ADREC, on the DARI platform), live since July 2025. Sharjah, Ajman
-- and the rest regulate developers rather than adverts, so they issue nothing
-- and a permit there has no authority at all.
--
-- The authority is NOT stored. It is one fact derived from the emirate in
-- src/lib/registry/authority.ts — storing both invites them to disagree.
--
-- This lives on the permit, not only on the project, for two reasons: a
-- general company-content code has no project to inherit from, and the
-- authority that issued a permit is a property of that permit. A project
-- could in principle be marketed under two.
--
-- text + CHECK rather than a pgEnum, exactly as 0027 did for `category`: the
-- eighth value, if the UAE ever has one, is then a constraint swap. 0024
-- documents why ALTER TYPE ... ADD VALUE cannot be used in this repo.
ALTER TABLE "permits" ADD COLUMN "emirate" text;--> statement-breakpoint

-- Inherit from the project where one names an emirate. 360 of 396 projects do.
UPDATE "permits" p SET "emirate" = pr."emirate"
  FROM "projects" pr
  WHERE pr.id = p.project_id AND pr."emirate" IS NOT NULL;--> statement-breakpoint

-- Everything still unset is Dubai. Every permit in this table today was issued
-- under Trakheesi — the general company codes included — and the 36 projects
-- carrying no emirate are all Dubai developers (Binghatti, Azizi, Ellington,
-- Deyaar, DAMAC, Sobha).
UPDATE "permits" SET "emirate" = 'Dubai' WHERE "emirate" IS NULL;--> statement-breakpoint

-- NOT NULL with no default, deliberately. A default of 'Dubai' would silently
-- mislabel the first Abu Dhabi permit if a write path forgot to set it, and
-- that is precisely the permit whose authority matters. Every write path is
-- made to say which emirate it means.
ALTER TABLE "permits" ALTER COLUMN "emirate" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "permits" ADD CONSTRAINT "permits_emirate" CHECK ("emirate" IN (
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
  'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'
));--> statement-breakpoint

-- And backfill the projects that never had one, so a permit issued against them
-- from now on inherits something real rather than falling through to a guess.
UPDATE "projects" SET "emirate" = 'Dubai' WHERE "emirate" IS NULL;
