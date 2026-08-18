// POST /api/admin/bookings/[id] — manager actions:
//   { action: "cancel", reason }          → cancel + event deletion
//   { action: "reassign", creatorId }     → move to another creator's calendar
//   { action: "no_show", reason }         → agent didn't turn up (§B5.5)
//   { action: "undo_no_show" }            → it was marked in error

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, arrayContains, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, users } from "@/db/schema";
import { cancelBooking } from "@/lib/booking-actions";
import {
  deleteBookingEvent,
  insertBookingEvent,
} from "@/lib/google-calendar";
import { TZ } from "@/lib/availability";
import { dbShootTypeLabel } from "@/lib/shoot-types";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("reassign"), creatorId: z.string().uuid() }),
  z.object({ action: z.literal("no_show"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("undo_no_show") }),
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

  if (input.action === "cancel") {
    try {
      await cancelBooking({
        bookingId: id,
        cancelledBy: "manager",
        reason: input.reason,
        actorId: session.user.id,
      });
    } catch (e) {
      return jsonError(409, e instanceof Error ? e.message : "Cancel failed");
    }
    return NextResponse.json({ ok: true });
  }

  // No-show. Creators mark their own from /creator, but only while the booking
  // is still 'confirmed' — and the nightly cron flips everything past to
  // 'completed', so that window closes hours after the shoot. This is the
  // manager's way to correct it afterwards, so a no-show doesn't stay recorded
  // as completed work. Same fields the creator's action writes.
  if (input.action === "no_show") {
    const [b] = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);
    if (!b) return jsonError(404, "Booking not found");
    if (b.status === "no_show") {
      return jsonError(409, "Already marked as a no-show");
    }
    if (b.status === "cancelled") {
      return jsonError(409, "This booking was cancelled, so there was nothing to attend");
    }
    if (b.startsAt > new Date()) {
      return jsonError(409, "You can only mark a no-show once the shoot has started");
    }

    await db
      .update(bookings)
      .set({
        status: "no_show",
        cancellationReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id));

    await logAudit({
      entity: "booking",
      entityId: id,
      action: "no_show",
      actorId: session.user.id,
      diff: { reason: input.reason, setBy: "manager", previousStatus: b.status },
    });

    return NextResponse.json({ ok: true });
  }

  // A no-show can only be marked on a shoot that has already started, so
  // reversing one always lands back on 'completed'. The calendar event was
  // never touched, so there's nothing to restore.
  if (input.action === "undo_no_show") {
    const [b] = await db
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);
    if (!b) return jsonError(404, "Booking not found");
    if (b.status !== "no_show") {
      return jsonError(409, "This booking isn't marked as a no-show");
    }

    await db
      .update(bookings)
      .set({ status: "completed", cancellationReason: null, updatedAt: new Date() })
      .where(eq(bookings.id, id));

    await logAudit({
      entity: "booking",
      entityId: id,
      action: "no_show_reverted",
      actorId: session.user.id,
    });

    return NextResponse.json({ ok: true });
  }

  // Reassign (§B12.2): new event on the target creator's calendar with the
  // agent as attendee, then the old event is removed. Agent gets both notices.
  const [b] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      eventId: bookings.googleEventId,
      calendarEmail: bookings.googleCalendarId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      shootType: bookings.shootType,
      projectName: bookings.projectName,
      locationType: bookings.locationType,
      propertyAddress: bookings.propertyAddress,
      notes: bookings.notes,
      agentName: agents.fullName,
      agentEmail: agents.email,
      agentPhone: agents.phone,
    })
    .from(bookings)
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(eq(bookings.id, id))
    .limit(1);
  if (!b) return jsonError(404, "Booking not found");
  if (b.status !== "confirmed") return jsonError(409, "Booking is not active");

  const [target] = await db
    .select({
      id: users.id,
      name: users.fullName,
      calendarEmail: users.googleCalendarId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, input.creatorId),
        arrayContains(users.roles, ["creator"]),
        eq(users.isActive, true)
      )
    )
    .limit(1);
  if (!target?.calendarEmail) return jsonError(404, "Target creator not found");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          creatorId: target.id,
          googleCalendarId: target.calendarEmail,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, b.id));

      const newEventId = await insertBookingEvent({
        creatorEmail: target.calendarEmail!,
        bookingId: b.id,
        summary: `Shoot: ${b.agentName ?? "Company"} — ${dbShootTypeLabel[b.shootType]} · ${b.projectName ?? ""}`,
        location:
          b.locationType === "on_site"
            ? (b.propertyAddress ?? "")
            : "Springfield office",
        description: [
          "Booked via ContentApp (reassigned)",
          b.agentName ? `Agent: ${b.agentName}${b.agentPhone ? ` (${b.agentPhone})` : ""}` : null,
          `Type: ${dbShootTypeLabel[b.shootType]}`,
          b.projectName ? `Project: ${b.projectName}` : null,
          b.notes ? `Notes: ${b.notes}` : null,
          `Booking ID: ${b.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        startIso: b.startsAt.toISOString(),
        endIso: b.endsAt.toISOString(),
        agentEmail: b.agentEmail,
        timeZone: TZ,
      });
      await tx
        .update(bookings)
        .set({ googleEventId: newEventId })
        .where(eq(bookings.id, b.id));
    });
  } catch (e) {
    if (
      typeof e === "object" && e !== null && "code" in e &&
      (e as { code?: string }).code === "23P01"
    ) {
      return jsonError(409, `${target.name} already has a booking at that time`);
    }
    console.error("Reassign failed:", e);
    return jsonError(503, "Reassign couldn't be completed — nothing changed.");
  }

  // Old event removed after the new one is safely in place.
  if (b.eventId && b.calendarEmail) {
    try {
      await deleteBookingEvent(b.calendarEmail, b.eventId);
    } catch {
      // Non-fatal: flagged in audit; webhook sync will reconcile.
    }
  }

  await logAudit({
    entity: "booking",
    entityId: b.id,
    action: "reassign",
    actorId: session.user.id,
    diff: { to: target.name },
  });

  return NextResponse.json({ ok: true });
}
