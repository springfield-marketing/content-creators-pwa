// PATCH /api/admin/permits/[id] — edit a general permit, or switch it on/off.
// Switching off rather than deleting: it changes who reviews future work, and
// the audit trail should still explain past routing.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { permits } from "@/db/schema";
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

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonError(400, "Invalid permit id");
  }

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
      .select({ id: permits.id })
      .from(permits)
      .where(
        and(
          eq(permits.category, "general"),
          eq(permits.permitNumber, code),
          ne(permits.id, id),
        ),
      )
      .limit(1);
    if (clash) {
      return jsonError(409, `${code} is already on the list.`);
    }
  }

  // The category guard is what stops this endpoint editing an offplan permit
  // by id — those are issued and renewed, never toggled.
  const [updated] = await db
    .update(permits)
    .set({
      ...(code !== undefined ? { permitNumber: code } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.expiresOn !== undefined ? { listingEnd: input.expiresOn } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(and(eq(permits.id, id), eq(permits.category, "general")))
    .returning({ id: permits.id, code: permits.permitNumber });
  if (!updated) return jsonError(404, "Permit not found");

  await logAudit({
    entity: "permit",
    entityId: String(id),
    action:
      input.isActive === undefined
        ? "update_general"
        : input.isActive
          ? "enable_general"
          : "disable_general",
    actorId: session.user.id,
    diff: { ...input, ...(code !== undefined ? { code } : {}) },
  });

  return NextResponse.json({ ok: true });
}
