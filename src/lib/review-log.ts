// Review log (removable feature). Records every review decision into the
// review_decisions table for accountability/feedback analysis, and reads it
// back for the /admin/reviews screen. Delete this file + the table + the
// /reviews route/screen + the recordReviewDecision() call to remove the feature.

import { db } from "@/db";
import { reviewDecisions } from "@/db/schema";

export type ReviewDecisionKind = "approved" | "changes_requested";

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
