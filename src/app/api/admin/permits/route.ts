// GET /api/admin/permits — general permit codes, with how often each is used.
//
// Adding one goes through /api/permits/issue with the rest, since the add form
// became one form for every kind of permit. What is left here is the list (for
// the "uses" count, which only makes sense for a code review routes on) and the
// row editor in [id].
//
// Guarded on `issuePermit`, not left to the proxy. The proxy's rule for this
// path is ["manager", "permit_admin", "marketing"] — the entry that lets
// marketing maintain the offplan registry — so relying on it alone let
// marketing create and edit the codes that decide who reviews content work.
// The UI already gated these actions on issuePermit; the API did not, and the
// API is the half that matters. Every other route in this module checks a
// capability the same way.
//
// These are rows in `permits` under category 'general'. The path stays under
// /api/admin because the audience has not changed — it is manager-only
// administration of who reviews what, not part of the registry agents use.

import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { permits } from "@/db/schema";
import { jsonError } from "@/lib/api";
import { can } from "@/lib/registry/access";

export async function GET() {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "issuePermit")) return jsonError(403, "Forbidden");

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
