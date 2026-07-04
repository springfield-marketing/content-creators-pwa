// GET /api/admin/review-queue — submitted deliverables awaiting review.

import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, deliverables, users } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select({
      id: deliverables.id,
      type: deliverables.type,
      url: deliverables.url,
      posted: deliverables.isPosted,
      workDate: deliverables.workDate,
      submittedAt: deliverables.createdAt,
      status: deliverables.reviewStatus,
      creatorId: deliverables.creatorId,
      creatorName: users.fullName,
      agentName: agents.fullName,
    })
    .from(deliverables)
    .innerJoin(users, eq(users.id, deliverables.creatorId))
    .leftJoin(agents, eq(agents.id, deliverables.agentId))
    .where(inArray(deliverables.reviewStatus, ["submitted", "under_review"]))
    .orderBy(desc(deliverables.createdAt));

  return NextResponse.json(
    rows.map((r) => ({ ...r, submittedAt: r.submittedAt?.toISOString() }))
  );
}
