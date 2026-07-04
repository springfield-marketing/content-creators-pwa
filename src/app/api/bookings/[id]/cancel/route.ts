// POST /api/bookings/[id]/cancel — agent cancellation via manage token.
// §B12.1 two-tier: >24h instant; ≤24h becomes a pending request that the
// manager or the creator approves.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/db";
import { cancellationRequests } from "@/db/schema";
import { bookingByToken } from "@/lib/manage-token";
import { cancelBooking } from "@/lib/booking-actions";
import { jsonError, parseBody, rateLimit } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(10),
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "manage-cancel", 10);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  const b = await bookingByToken(id, parsed.data.token);
  if (!b) return jsonError(404, "This booking link is invalid or has expired.");

  const hoursUntil = dayjs(b.startsAt).diff(dayjs(), "hour", true);

  if (hoursUntil >= 24) {
    await cancelBooking({
      bookingId: b.id,
      cancelledBy: "agent",
      reason: parsed.data.reason,
    });
    return NextResponse.json({ outcome: "cancelled" });
  }

  // ≤24h: request, not action. Booking (and the slot) stays until decided.
  await db.insert(cancellationRequests).values({
    bookingId: b.id,
    requestedBy: "agent",
    reason: parsed.data.reason,
  });
  await logAudit({
    entity: "booking",
    entityId: b.id,
    action: "cancel_requested",
    diff: { requestedBy: "agent", reason: parsed.data.reason },
  });
  // TODO(Resend): notify manager + creator by email.
  return NextResponse.json({ outcome: "requested" });
}
