// GET /api/bookings/[id]?token= — the agent's manage view (no login).

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cancellationRequests } from "@/db/schema";
import { bookingByToken } from "@/lib/manage-token";
import { jsonError, rateLimit } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "manage-view", 30);
  if (limited) return limited;

  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const b = await bookingByToken(id, token);
  if (!b) return jsonError(404, "This booking link is invalid or has expired.");

  const [pending] = await db
    .select({ id: cancellationRequests.id })
    .from(cancellationRequests)
    .where(
      and(
        eq(cancellationRequests.bookingId, b.id),
        eq(cancellationRequests.status, "pending")
      )
    )
    .limit(1);

  return NextResponse.json({
    id: b.id,
    creatorName: b.creatorName,
    creatorSlug: b.creatorSlug,
    agentName: b.agentName,
    start: b.startsAt.toISOString(),
    end: b.endsAt.toISOString(),
    shootType: b.shootType,
    projectName: b.projectName,
    locationType: b.locationType,
    propertyAddress: b.propertyAddress,
    notes: b.notes,
    status: b.status,
    instantCancel: dayjs(b.startsAt).diff(dayjs(), "hour") >= 24,
    pendingCancellation: !!pending,
  });
}
