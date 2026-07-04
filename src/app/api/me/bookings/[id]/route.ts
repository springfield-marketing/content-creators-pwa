// POST /api/me/bookings/[id] — creator actions on their own booking:
//   { action: "no_show", reason }              → mark no-show (§B5.5)
//   { action: "cancel", reason }               → DIRECT cancel (decision #12)
//   { action: "complete", actualEnd? }         → done + overtime (decision #8)

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { cancelBooking } from "@/lib/booking-actions";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("no_show"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(1000) }),
  z.object({
    action: z.literal("complete"),
    actualEnd: z.string().datetime({ offset: true }).optional(),
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

  const [b] = await db
    .select({
      id: bookings.id,
      start: bookings.startsAt,
      end: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.creatorId, session.user.id)))
    .limit(1);
  if (!b) return jsonError(404, "Booking not found");
  if (b.status !== "confirmed") return jsonError(409, "Booking is not active");

  if (input.action === "cancel") {
    await cancelBooking({
      bookingId: b.id,
      cancelledBy: "creator",
      reason: input.reason,
      actorId: session.user.id,
    });
    // TODO(Resend): inform the manager.
    return NextResponse.json({ ok: true });
  }

  if (input.action === "no_show") {
    if (dayjs(b.start).isAfter(dayjs())) {
      return jsonError(409, "You can only mark a no-show once the shoot has started");
    }
    await db
      .update(bookings)
      .set({
        status: "no_show",
        cancellationReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, b.id));
    await logAudit({
      entity: "booking",
      entityId: b.id,
      action: "no_show",
      actorId: session.user.id,
      diff: { reason: input.reason },
    });
    return NextResponse.json({ ok: true });
  }

  // complete (+ optional overtime)
  if (dayjs(b.start).isAfter(dayjs())) {
    return jsonError(409, "This shoot hasn't started yet");
  }
  const actualEnd = input.actualEnd ? new Date(input.actualEnd) : null;
  if (actualEnd && actualEnd <= b.start) {
    return jsonError(422, "Actual end must be after the shoot start");
  }
  await db
    .update(bookings)
    .set({
      status: "completed",
      actualEndsAt: actualEnd,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, b.id));
  await logAudit({
    entity: "booking",
    entityId: b.id,
    action: "complete",
    actorId: session.user.id,
    diff: actualEnd
      ? { actualEnd: actualEnd.toISOString(), overtimeMinutes: Math.round((actualEnd.getTime() - b.end.getTime()) / 60000) }
      : {},
  });
  return NextResponse.json({ ok: true });
}
