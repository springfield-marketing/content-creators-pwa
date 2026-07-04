// GET  /api/admin/cancellation-requests — pending ≤24h agent requests.
// POST /api/admin/cancellation-requests — { id, approve: boolean } decide.

import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, cancellationRequests, users } from "@/db/schema";
import { cancelBooking } from "@/lib/booking-actions";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const rows = await db
    .select({
      id: cancellationRequests.id,
      reason: cancellationRequests.reason,
      createdAt: cancellationRequests.createdAt,
      bookingId: bookings.id,
      start: bookings.startsAt,
      projectName: bookings.projectName,
      creatorName: users.fullName,
      agentName: agents.fullName,
    })
    .from(cancellationRequests)
    .innerJoin(bookings, eq(bookings.id, cancellationRequests.bookingId))
    .innerJoin(users, eq(users.id, bookings.creatorId))
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(eq(cancellationRequests.status, "pending"))
    .orderBy(desc(cancellationRequests.createdAt));

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      start: r.start.toISOString(),
      createdAt: r.createdAt?.toISOString(),
    }))
  );
}

const decideSchema = z.object({
  id: z.string().uuid(),
  approve: z.boolean(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, decideSchema);
  if ("error" in parsed) return parsed.error;
  const { id, approve } = parsed.data;

  const [r] = await db
    .select({
      id: cancellationRequests.id,
      bookingId: cancellationRequests.bookingId,
      reason: cancellationRequests.reason,
      status: cancellationRequests.status,
    })
    .from(cancellationRequests)
    .where(eq(cancellationRequests.id, id))
    .limit(1);
  if (!r) return jsonError(404, "Request not found");
  if (r.status !== "pending") return jsonError(409, "Already decided");

  if (approve) {
    await cancelBooking({
      bookingId: r.bookingId,
      cancelledBy: "agent",
      reason: r.reason,
      actorId: session.user.id,
    });
  }
  await db
    .update(cancellationRequests)
    .set({
      status: approve ? "approved" : "declined",
      decidedBy: session.user.id,
      decidedAt: new Date(),
    })
    .where(eq(cancellationRequests.id, id));

  await logAudit({
    entity: "booking",
    entityId: r.bookingId,
    action: approve ? "cancel_request_approved" : "cancel_request_declined",
    actorId: session.user.id,
  });
  // TODO(Resend): notify the agent of the decision.

  return NextResponse.json({ ok: true });
}
