// POST /api/bookings/[id]/reschedule — atomic re-book (§B12.1): validate the
// new slot server-side, patch the existing event (attendees auto-notified),
// update Postgres. If validation fails, nothing changes.

import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { bookingByToken } from "@/lib/manage-token";
import {
  CalendarUnavailableError,
  getAvailability,
  TZ,
} from "@/lib/availability";
import { patchBookingEventTimes } from "@/lib/google-calendar";
import { jsonError, parseBody, rateLimit } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(10),
  shootType: z.enum(["photo", "video", "photo_video"]),
  start: z.string().datetime({ offset: true }),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "manage-reschedule", 10);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  const b = await bookingByToken(id, input.token);
  if (!b) return jsonError(404, "This booking link is invalid or has expired.");
  if (!b.creatorSlug || !b.eventId || !b.calendarEmail) {
    return jsonError(409, "This booking can't be rescheduled — contact the manager.");
  }

  let availability;
  try {
    availability = await getAvailability(b.creatorSlug, input.shootType);
  } catch (e) {
    if (e instanceof CalendarUnavailableError) {
      return jsonError(503, "Live availability is temporarily unavailable — please try again in a few minutes.");
    }
    throw e;
  }
  const slot = availability?.slots.find(
    (s) => dayjs(s.start).toISOString() === dayjs(input.start).toISOString()
  );
  if (!slot) {
    return jsonError(409, "That slot is no longer available — please pick another time.");
  }

  const old = { start: b.startsAt.toISOString(), end: b.endsAt.toISOString() };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          startsAt: new Date(slot.start),
          endsAt: new Date(slot.end),
          shootType: input.shootType,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, b.id));
      // Calendar patch inside the transaction: failure rolls the times back.
      await patchBookingEventTimes({
        creatorEmail: b.calendarEmail!,
        eventId: b.eventId!,
        startIso: slot.start,
        endIso: slot.end,
        timeZone: TZ,
      });
    });
  } catch (e) {
    if (
      typeof e === "object" && e !== null && "code" in e &&
      (e as { code?: string }).code === "23P01"
    ) {
      return jsonError(409, "That slot was just taken — please pick another time.");
    }
    console.error("Reschedule failed:", e);
    return jsonError(503, "The reschedule couldn't be completed — your original booking is unchanged.");
  }

  await logAudit({
    entity: "booking",
    entityId: b.id,
    action: "reschedule",
    diff: { from: old, to: { start: slot.start, end: slot.end } },
  });

  return NextResponse.json({ start: slot.start, end: slot.end });
}
