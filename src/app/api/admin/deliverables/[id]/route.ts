// POST /api/admin/deliverables/[id] — review decision:
//   { action: "approve" } | { action: "request_changes", comment }
//   { action: "unapprove" } → back to the queue after a mistaken approval
//   { action: "edit", ... }  → correct a link, permit or image count
//   { action: "delete", reason } → remove one logged in error

import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { deliverables, reviewDecisions } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { recordReviewDecision } from "@/lib/review-log";
import { hidesGeneralPermits, isGeneralPermit } from "@/lib/general-permits";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("unapprove") }),
  z.object({
    action: z.literal("delete"),
    reason: z.string().trim().min(3).max(500),
  }),
  z
    .object({
      action: z.literal("edit"),
      url: z.string().url().max(2000).optional(),
      title: z.string().trim().min(1).max(200).optional(),
      permitNumber: z.string().trim().min(1).max(100).optional(),
      imageCount: z.number().int().min(0).max(10000).optional(),
    })
    .refine((v) => Object.keys(v).length > 1, { message: "Nothing to change" }),
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
      imageCount: deliverables.imageCount,
      url: deliverables.url,
      title: deliverables.title,
      isPosted: deliverables.isPosted,
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
  // Removing one logged in error — a duplicate, or work that was never done.
  //
  // A real delete rather than a hidden flag: deliverables are read in fourteen
  // places, and a flag missed in any one of them leaves a "deleted" deliverable
  // still counting toward someone's KPIs, which is the problem this is meant to
  // solve. The row and its review decisions are written into the audit entry
  // first, so the record survives even though the data doesn't.
  if (input.action === "delete") {
    if (d.isPosted) {
      return jsonError(
        409,
        "This has been posted, so it can't be removed — correct it instead."
      );
    }

    const [full] = await db
      .select()
      .from(deliverables)
      .where(eq(deliverables.id, id))
      .limit(1);
    const decisions = await db
      .select()
      .from(reviewDecisions)
      .where(eq(reviewDecisions.deliverableId, id));

    await logAudit({
      entity: "deliverable",
      entityId: id,
      action: "delete",
      actorId: session.user.id,
      diff: { reason: input.reason, deliverable: full, reviewDecisions: decisions },
    });

    await db.transaction(async (tx) => {
      // The only thing pointing at a deliverable, so it has to go first.
      await tx.delete(reviewDecisions).where(eq(reviewDecisions.deliverableId, id));
      await tx.delete(deliverables).where(eq(deliverables.id, id));
    });

    return NextResponse.json({ ok: true });
  }

  // Correcting a deliverable without disturbing its review state — a wrong
  // link, a mistyped permit, or an image count on work logged before counts
  // existed. Allowed at any status, since the 40 photo deliverables needing a
  // count were approved months ago and can't be sent back for it.
  if (input.action === "edit") {
    const changes = Object.fromEntries(
      Object.entries(input).filter(([k, v]) => k !== "action" && v !== undefined)
    );

    await db.update(deliverables).set(changes).where(eq(deliverables.id, id));

    await logAudit({
      entity: "deliverable",
      entityId: id,
      action: "edit",
      actorId: session.user.id,
      diff: {
        changed: changes,
        // Kept so a wrong correction can be traced back.
        previous: {
          url: d.url,
          title: d.title,
          permitNumber: d.permitNumber,
          imageCount: d.imageCount,
        },
      },
    });

    return NextResponse.json({ ok: true });
  }

  // Undo a mistaken approval: back to the queue for a proper decision. The
  // creator is told nothing and needs to do nothing — it isn't a rejection.
  if (input.action === "unapprove") {
    if (d.status !== "approved") {
      return jsonError(409, "Only an approved deliverable can be returned to the queue");
    }
    if (d.isPosted) {
      return jsonError(409, "This has already been posted, so it can't be un-approved");
    }

    // Kept in the audit entry, because the review-log row is about to go.
    const [decision] = await db
      .select()
      .from(reviewDecisions)
      .where(eq(reviewDecisions.deliverableId, id))
      .orderBy(desc(reviewDecisions.decidedAt))
      .limit(1);

    await db
      .update(deliverables)
      .set({ reviewStatus: "submitted", reviewedBy: null, reviewedAt: null })
      .where(eq(deliverables.id, id));

    await db.delete(reviewDecisions).where(eq(reviewDecisions.deliverableId, id));

    await logAudit({
      entity: "deliverable",
      entityId: id,
      action: "approval_reverted",
      actorId: session.user.id,
      diff: {
        previousReviewer: decision?.reviewerId ?? null,
        previousDecidedAt: decision?.decidedAt ?? null,
        deletedReviewDecision: decision ?? null,
      },
    });

    return NextResponse.json({ ok: true });
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
