// Review log (removable feature). Records every review decision into the
// review_decisions table for accountability/feedback analysis, and reads it
// back for the /admin/reviews screen. Delete this file + the table + the
// /reviews route/screen + the recordReviewDecision() call to remove the feature.

import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { agents, bookings, deliverables, reviewDecisions, users } from "@/db/schema";

export type ReviewDecisionKind = "approved" | "changes_requested";

export type ReviewRow = {
  at: string; // decided_at
  submittedAt: string | null; // deliverable submission, for time-to-decision
  reviewer: string | null;
  creator: string | null;
  decision: ReviewDecisionKind;
  comment: string | null;
  permit: string | null;
  type: string | null; // deliverable type
  videoName: string | null; // shoot project, else agent
  url: string | null;
};

// Best-effort: the audit log is the backstop, so a failure here must never
// block a review from going through.
export async function recordReviewDecision(params: {
  deliverableId: string;
  creatorId: string;
  reviewerId: string;
  decision: ReviewDecisionKind;
  comment?: string | null;
  permitNumber?: string | null;
}) {
  try {
    await db.insert(reviewDecisions).values({
      deliverableId: params.deliverableId,
      creatorId: params.creatorId,
      reviewerId: params.reviewerId,
      decision: params.decision,
      comment: params.comment ?? null,
      permitNumber: params.permitNumber ?? null,
    });
  } catch (e) {
    console.error("recordReviewDecision failed:", e);
  }
}

// Every review decision for a Dubai-month, enriched for the /admin/reviews
// screen. The screen does its own filtering and reviewer-summary maths.
export async function getReviewLog(month: string): Promise<ReviewRow[]> {
  const reviewer = alias(users, "reviewer");
  const creator = alias(users, "creator");
  const dAgent = alias(agents, "d_agent");

  const rows = await db
    .select({
      at: reviewDecisions.decidedAt,
      submittedAt: deliverables.createdAt,
      reviewerName: reviewer.fullName,
      creatorName: creator.fullName,
      decision: reviewDecisions.decision,
      comment: reviewDecisions.comment,
      permit: reviewDecisions.permitNumber,
      type: deliverables.type,
      project: bookings.projectName,
      agentName: dAgent.fullName,
      url: deliverables.url,
    })
    .from(reviewDecisions)
    .leftJoin(reviewer, eq(reviewer.id, reviewDecisions.reviewerId))
    .leftJoin(creator, eq(creator.id, reviewDecisions.creatorId))
    .leftJoin(deliverables, eq(deliverables.id, reviewDecisions.deliverableId))
    .leftJoin(bookings, eq(bookings.id, deliverables.bookingId))
    .leftJoin(dAgent, eq(dAgent.id, deliverables.agentId))
    .where(
      sql`date_trunc('month', ${reviewDecisions.decidedAt} AT TIME ZONE 'Asia/Dubai') = ${`${month}-01`}::date`
    )
    .orderBy(desc(reviewDecisions.decidedAt));

  return rows.map((r) => ({
    at: r.at.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    reviewer: r.reviewerName,
    creator: r.creatorName,
    decision: r.decision as ReviewDecisionKind,
    comment: r.comment,
    permit: r.permit,
    type: r.type,
    videoName: r.project || r.agentName || null,
    url: r.url,
  }));
}
