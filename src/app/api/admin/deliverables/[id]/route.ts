// POST /api/admin/deliverables/[id] — review decision:
//   { action: "approve" } | { action: "request_changes", comment }

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { deliverables } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    // Recorded on video approvals; required for videos (enforced below once
    // we know the deliverable type).
    permitNumber: z.string().trim().min(1).max(100).optional(),
  }),
  z.object({
    action: z.literal("request_changes"),
    comment: z.string().trim().min(3).max(2000),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  const [d] = await db
    .select({
      id: deliverables.id,
      status: deliverables.reviewStatus,
      type: deliverables.type,
      creatorId: deliverables.creatorId,
    })
    .from(deliverables)
    .where(eq(deliverables.id, id))
    .limit(1);
  if (!d) return jsonError(404, "Deliverable not found");
  // Enforced here, not just hidden from the queue: reviewedBy has to name
  // someone other than the creator for the audit trail to mean anything.
  if (d.creatorId === session.user.id) {
    return jsonError(403, "You can't review your own deliverable");
  }
  // A video can't be approved without recording its permit number.
  if (
    input.action === "approve" &&
    d.type === "video_shoot" &&
    !input.permitNumber
  ) {
    return jsonError(422, "Permit number is required to approve a video");
  }

  await db
    .update(deliverables)
    .set({
      reviewStatus: input.action === "approve" ? "approved" : "needs_revision",
      reviewComment: input.action === "request_changes" ? input.comment : null,
      permitNumber:
        input.action === "approve" ? (input.permitNumber ?? null) : undefined,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    })
    .where(eq(deliverables.id, id));

  await logAudit({
    entity: "deliverable",
    entityId: id,
    action: input.action,
    actorId: session.user.id,
    diff:
      input.action === "request_changes"
        ? { comment: input.comment }
        : { permitNumber: input.permitNumber ?? null },
  });
  // TODO(Resend): notify the creator on request_changes.

  return NextResponse.json({ ok: true });
}
