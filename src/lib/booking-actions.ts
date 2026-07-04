// Shared booking mutations used by the manage link, creator schedule, and
// admin overview. Calendar first, then DB — a calendar failure aborts.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { deleteBookingEvent } from "@/lib/google-calendar";
import { logAudit } from "@/lib/audit";

export type CancelledBy = "agent" | "creator" | "manager" | "system";

export async function cancelBooking(params: {
  bookingId: string;
  cancelledBy: CancelledBy;
  reason: string;
  actorId?: string | null;
}) {
  const [b] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      eventId: bookings.googleEventId,
      calendarEmail: bookings.googleCalendarId,
    })
    .from(bookings)
    .where(eq(bookings.id, params.bookingId))
    .limit(1);
  if (!b) throw new Error("Booking not found");
  if (b.status !== "confirmed") throw new Error("Booking is not active");

  if (b.eventId && b.calendarEmail) {
    try {
      await deleteBookingEvent(b.calendarEmail, b.eventId);
    } catch (e) {
      // Already-deleted events (410/404) are fine; anything else aborts.
      const status = (e as { status?: number; code?: number }).status ??
        (e as { code?: number }).code;
      if (status !== 404 && status !== 410) throw e;
    }
  }

  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledBy: params.cancelledBy,
      cancellationReason: params.reason,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, params.bookingId));

  await logAudit({
    entity: "booking",
    entityId: params.bookingId,
    action: "cancel",
    actorId: params.actorId ?? null,
    diff: { cancelledBy: params.cancelledBy, reason: params.reason },
  });
}
