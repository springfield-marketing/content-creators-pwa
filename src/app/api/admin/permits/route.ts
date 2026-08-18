// GET  /api/admin/permits — general permit codes, with how often each is used.
// POST /api/admin/permits — add one.
// Manager-only: the proxy's "/api/admin" entry covers this path.

import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { generalPermits } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { digitsOnly } from "@/lib/general-permits";

export async function GET() {
  const rows = await db
    .select({
      id: generalPermits.id,
      code: generalPermits.code,
      label: generalPermits.label,
      isActive: generalPermits.isActive,
      expiresOn: generalPermits.expiresOn,
      createdAt: generalPermits.createdAt,
      // Deliverables already logged under this code, so the manager can see
      // what removing it would affect.
      uses: sql<number>`(
        select count(*)::int from deliverables d
        where regexp_replace(coalesce(d.permit_number, ''), '[^0-9]', '', 'g') = ${generalPermits.code}
      )`,
    })
    .from(generalPermits)
    .orderBy(asc(generalPermits.label));

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
    .select({ id: generalPermits.id, isActive: generalPermits.isActive })
    .from(generalPermits)
    .where(eq(generalPermits.code, code))
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
    .insert(generalPermits)
    .values({
      code,
      label: parsed.data.label,
      expiresOn: parsed.data.expiresOn ?? null,
      createdBy: session.user.id,
    })
    .returning({ id: generalPermits.id });

  await logAudit({
    entity: "general_permit",
    entityId: created.id,
    action: "create",
    actorId: session.user.id,
    diff: { code, label: parsed.data.label, expiresOn: parsed.data.expiresOn ?? null },
  });

  return NextResponse.json({ id: created.id, code }, { status: 201 });
}
