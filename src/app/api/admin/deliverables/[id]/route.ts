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
import { recordReviewDecision } from "@/lib/review-log";
import { hidesGeneralPermits, isGeneralPermit } from "@/lib/general-permits";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
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
      permitNumber: deliverables.permitNumber,
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
  // Same reasoning: general-permit work is filtered out of a team lead's queue,
  // but the queue isn't the only way to reach this endpoint.
  if (
    hidesGeneralPermits(session.user.roles) &&
    (await isGeneralPermit(d.permitNumber))
  ) {
    return jsonError(403, "General-permit work is reviewed by a manager");
  }
  await db
    .update(deliverables)
    .set({
      reviewStatus: input.action === "approve" ? "approved" : "needs_revision",
      reviewComment: input.action === "request_changes" ? input.comment : null,
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
        : { permitNumber: d.permitNumber },
  });
  // TODO(Resend): notify the creator on request_changes.

  // Review log (removable feature): durable record of this decision.
  await recordReviewDecision({
    deliverableId: id,
    creatorId: d.creatorId,
    reviewerId: session.user.id,
    decision: input.action === "approve" ? "approved" : "changes_requested",
    comment: input.action === "request_changes" ? input.comment : null,
    // Copied from the deliverable (creator-supplied) so the review log keeps
    // reporting permit coverage on approvals.
    permitNumber: input.action === "approve" ? d.permitNumber : null,
  });

  return NextResponse.json({ ok: true });
}
