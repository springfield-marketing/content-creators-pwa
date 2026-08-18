// PATCH /api/admin/permits/[id] — edit a general permit, or switch it on/off.
// Switching off rather than deleting: it changes who reviews future work, and
// the audit trail should still explain past routing.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { generalPermits } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { digitsOnly } from "@/lib/general-permits";

// All optional: the row toggle sends only isActive, the edit form sends the
// rest. At least one field has to be present or there's nothing to do.
const schema = z
  .object({
    isActive: z.boolean(),
    code: z.string().trim().min(1).max(100),
    label: z.string().trim().min(2).max(120),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Empty update" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  // Codes are stored as digits, so a pasted "General QR code 2113748196"
  // normalises the same way here as it does on create.
  let code: string | undefined;
  if (input.code !== undefined) {
    code = digitsOnly(input.code);
    if (!code) {
      return jsonError(422, "A permit code must contain at least one digit");
    }
    const [clash] = await db
      .select({ id: generalPermits.id })
      .from(generalPermits)
      .where(and(eq(generalPermits.code, code), ne(generalPermits.id, id)))
      .limit(1);
    if (clash) {
      return jsonError(409, `${code} is already on the list.`);
    }
  }

  const [updated] = await db
    .update(generalPermits)
    .set({
      ...(code !== undefined ? { code } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.expiresOn !== undefined ? { expiresOn: input.expiresOn } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(generalPermits.id, id))
    .returning({ id: generalPermits.id, code: generalPermits.code });
  if (!updated) return jsonError(404, "Permit not found");

  await logAudit({
    entity: "general_permit",
    entityId: id,
    action:
      input.isActive === undefined
        ? "update"
        : input.isActive
          ? "enable"
          : "disable",
    actorId: session.user.id,
    diff: { ...input, ...(code !== undefined ? { code } : {}) },
  });

  return NextResponse.json({ ok: true });
}
