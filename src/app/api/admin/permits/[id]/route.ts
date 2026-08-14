// PATCH /api/admin/permits/[id] — switch a general permit on or off.
// Kept as a toggle rather than a delete: turning one off changes who reviews
// future work, and the audit trail should still explain past routing.

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { generalPermits } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  isActive: z.boolean(),
  label: z.string().trim().min(2).max(120).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  const [updated] = await db
    .update(generalPermits)
    .set(parsed.data)
    .where(eq(generalPermits.id, id))
    .returning({ id: generalPermits.id, code: generalPermits.code });
  if (!updated) return jsonError(404, "Permit not found");

  await logAudit({
    entity: "general_permit",
    entityId: id,
    action: parsed.data.isActive ? "enable" : "disable",
    actorId: session.user.id,
    diff: { code: updated.code, ...parsed.data },
  });

  return NextResponse.json({ ok: true });
}
