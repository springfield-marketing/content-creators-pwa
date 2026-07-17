// GET /api/admin/review-queue — submitted deliverables awaiting review.
// Nobody signs off their own shoot: a team_lead who also creates never sees
// their own work here. For managers the filter matches nothing, since they
// have no deliverables of their own.

import { NextResponse } from "next/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, deliverables, users } from "@/db/schema";
import { jsonError } from "@/lib/api";

export async function GET() {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

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
    .where(
      and(
        inArray(deliverables.reviewStatus, ["submitted", "under_review"]),
        ne(deliverables.creatorId, session.user.id)
      )
    )
    .orderBy(desc(deliverables.createdAt));

  return NextResponse.json(
    rows.map((r) => ({ ...r, submittedAt: r.submittedAt?.toISOString() }))
  );
}
