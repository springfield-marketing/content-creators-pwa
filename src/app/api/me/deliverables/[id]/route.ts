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
    permitNumber: z.string().trim().min(1).max(100).optional(),
    imageCount: z.number().int().min(0).max(10000).optional(),
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
      type: deliverables.type,
      permitNumber: deliverables.permitNumber,
      imageCount: deliverables.imageCount,
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
  // A video must carry a permit by the time it goes back for review — either
  // one it already had, or one supplied with this resubmit.
  if (
    d.type === "video_shoot" &&
    !parsed.data.permitNumber &&
    !d.permitNumber
  ) {
    return jsonError(422, "A permit number is required for videos");
  }
  // Same for a photo's image count: it must be there by the time review sees it.
  if (
    d.type === "photo_shoot" &&
    parsed.data.imageCount == null &&
    d.imageCount == null
  ) {
    return jsonError(422, "An image count is required for photo shoots");
  }

  await db
    .update(deliverables)
    .set({
      reviewStatus: "submitted",
      ...(parsed.data.url ? { url: parsed.data.url } : {}),
      ...(parsed.data.permitNumber
        ? { permitNumber: parsed.data.permitNumber }
        : {}),
      ...(parsed.data.imageCount != null
        ? { imageCount: parsed.data.imageCount }
        : {}),
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
