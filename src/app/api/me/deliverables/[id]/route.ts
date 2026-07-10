// PATCH /api/me/deliverables/[id] — creator actions on their own deliverable:
//   { action: "resubmit", url? }   after a revision request
//   { action: "mark_posted" }      approved work published to socials

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { deliverables } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resubmit"),
    url: z.string().url().max(2000).optional(),
  }),
  z.object({ action: z.literal("mark_posted") }),
]);

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
    .select({
      id: deliverables.id,
      status: deliverables.reviewStatus,
      isPosted: deliverables.isPosted,
    })
    .from(deliverables)
    .where(
      and(eq(deliverables.id, id), eq(deliverables.creatorId, session.user.id))
    )
    .limit(1);
  if (!d) return jsonError(404, "Deliverable not found");

  if (parsed.data.action === "mark_posted") {
    if (d.status !== "approved") {
      return jsonError(409, "Only approved deliverables can be marked as posted");
    }
    if (d.isPosted) return jsonError(409, "Already marked as posted");
    await db
      .update(deliverables)
      .set({ isPosted: true, postedAt: new Date() })
      .where(eq(deliverables.id, id));
    await logAudit({
      entity: "deliverable",
      entityId: id,
      action: "mark_posted",
      actorId: session.user.id,
    });
    return NextResponse.json({ ok: true });
  }

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
