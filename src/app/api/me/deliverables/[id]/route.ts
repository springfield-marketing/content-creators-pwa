// PATCH /api/me/deliverables/[id] — resubmit after a revision request.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { deliverables } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  url: z.string().url().max(2000).optional(),
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

  const [d] = await db
    .select({ id: deliverables.id, status: deliverables.reviewStatus })
    .from(deliverables)
    .where(
      and(eq(deliverables.id, id), eq(deliverables.creatorId, session.user.id))
    )
    .limit(1);
  if (!d) return jsonError(404, "Deliverable not found");
  if (d.status !== "needs_revision") {
    return jsonError(409, "Only deliverables sent back for revision can be resubmitted");
  }

  await db
    .update(deliverables)
    .set({
      reviewStatus: "submitted",
      ...(parsed.data.url ? { url: parsed.data.url } : {}),
    })
    .where(eq(deliverables.id, id));

  await logAudit({
    entity: "deliverable",
    entityId: id,
    action: "resubmit",
    actorId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
