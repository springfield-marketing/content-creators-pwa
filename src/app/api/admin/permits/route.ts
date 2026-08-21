// GET  /api/admin/permits — general permit codes, with how often each is used.
// POST /api/admin/permits — add one.
// Manager-only: the proxy's "/api/admin" entry covers this path.
//
// These are rows in `permits` under category 'general'. The path stays under
// /api/admin because the audience has not changed — it is manager-only
// administration of who reviews what, not part of the registry agents use.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { permits } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { digitsOnly } from "@/lib/general-permits";

export async function GET() {
  const rows = await db
    .select({
      id: permits.id,
      code: permits.permitNumber,
      label: permits.label,
      isActive: permits.isActive,
      expiresOn: permits.listingEnd,
      createdAt: permits.createdAt,
      // Deliverables already logged under this code, so the manager can see
      // what removing it would affect.
      //
      // "permits"."permit_number" is written out rather than interpolated.
      // Drizzle omits the table qualifier for the statement's own FROM table,
      // which left a bare `permit_number` inside the subquery — where it binds
      // to `deliverables`, not to the outer row. Every code then reported the
      // same count (the number of deliverables whose permit is already pure
      // digits) instead of its own. It only appeared when general permits moved
      // into this table: the old column was `code`, which deliverables has no
      // column to shadow.
      uses: sql<number>`(
        select count(*)::int from deliverables d
        where regexp_replace(coalesce(d.permit_number, ''), '[^0-9]', '', 'g') = "permits"."permit_number"
      )`,
    })
    .from(permits)
    .where(eq(permits.category, "general"))
    .orderBy(asc(permits.label));

  return NextResponse.json(
    rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() ?? null }))
  );
}

const createSchema = z.object({
  // Free text in, digits out — managers paste the permit as they received it.
  code: z.string().trim().min(1).max(100),
  label: z.string().trim().min(2).max(120),
  // Optional: not every permit states one, and it only ever warns.
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, createSchema);
  if ("error" in parsed) return parsed.error;

  const code = digitsOnly(parsed.data.code);
  if (!code) {
    return jsonError(422, "A permit code must contain at least one digit");
  }

  const [existing] = await db
    .select({ id: permits.id, isActive: permits.isActive })
    .from(permits)
    .where(and(eq(permits.category, "general"), eq(permits.permitNumber, code)))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      {
        error: existing.isActive
          ? `${code} is already a general permit.`
          : `${code} is on the list but switched off — turn it back on instead.`,
      },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(permits)
    .values({
      category: "general",
      permitNumber: code,
      label: parsed.data.label,
      // A general permit's expiry is the date it stops being valid, which is
      // what listing_end means; there is no start to record.
      listingEnd: parsed.data.expiresOn ?? null,
      issuedByEmail: session.user.email,
    })
    .returning({ id: permits.id });

  await logAudit({
    entity: "permit",
    entityId: String(created.id),
    action: "create_general",
    actorId: session.user.id,
    diff: { code, label: parsed.data.label, expiresOn: parsed.data.expiresOn ?? null },
  });

  return NextResponse.json({ id: created.id, code }, { status: 201 });
}
