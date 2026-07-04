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
    .select({ id: deliverables.id, status: deliverables.reviewStatus })
    .from(deliverables)
    .where(eq(deliverables.id, id))
    .limit(1);
  if (!d) return jsonError(404, "Deliverable not found");

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
    diff: input.action === "request_changes" ? { comment: input.comment } : {},
  });
  // TODO(Resend): notify the creator on request_changes.

  return NextResponse.json({ ok: true });
}
