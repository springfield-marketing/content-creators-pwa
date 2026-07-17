// POST /api/bookings — the booking transaction (§B5.2).
//
// Never trusts the client's slot: re-runs the §B12.3 availability check
// server-side, inserts the booking, then creates the Google Calendar event
// with the agent as attendee. If the calendar write fails the transaction
// rolls back — no DB-only bookings that never reached a calendar. The
// no_overlapping_confirmed exclusion constraint is the final backstop
// against two agents racing for the same slot.

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { and, arrayContains, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, bookings, users } from "@/db/schema";
import {
  CalendarUnavailableError,
  getAvailability,
  TZ,
} from "@/lib/availability";
import { insertBookingEvent } from "@/lib/google-calendar";
import { dbShootTypeLabel } from "@/lib/shoot-types";
import { jsonError, parseBody, rateLimit } from "@/lib/api";
import { bookingCreateSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { sendBookingConfirmation } from "@/lib/email";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function POST(req: Request) {
  const limited = rateLimit(req, "booking-create", 10);
  if (limited) return limited;

  const parsed = await parseBody(req, bookingCreateSchema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  const [creator] = await db
    .select({
      id: users.id,
      name: users.fullName,
      calendarEmail: users.googleCalendarId,
      isActive: users.isActive,
    })
    .from(users)
    .where(
      and(
        eq(users.slug, input.creatorSlug),
        arrayContains(users.roles, ["creator"])
      )
    )
    .limit(1);
  if (!creator || !creator.isActive || !creator.calendarEmail) {
    return jsonError(404, "Creator not found");
  }

  const [agent] = await db
    .select({
      id: agents.id,
      name: agents.fullName,
      email: agents.email,
      phone: agents.phone,
      isActive: agents.isActive,
    })
    .from(agents)
    .where(eq(agents.id, input.agentId))
    .limit(1);
  // Unapproved (self-registered) agents may book — approval gates the
  // search listing; email verification for them activates with Resend.
  if (!agent || !agent.isActive) {
    return jsonError(403, "This agent can't make bookings");
  }

  // §B5.1: re-run availability inside the request — never trust the client.
  let availability;
  try {
    availability = await getAvailability(input.creatorSlug, input.shootType);
  } catch (e) {
    if (e instanceof CalendarUnavailableError) {
      return jsonError(503, "Live availability is temporarily unavailable — please try again in a few minutes.");
    }
    throw e;
  }
  if (!availability) return jsonError(404, "Creator not found");

  const slot = availability.slots.find(
    (s) => dayjs(s.start).toISOString() === dayjs(input.start).toISOString()
  );
  if (!slot) {
    return jsonError(409, "That slot is no longer available — please pick another time.");
  }

  const manageToken = randomBytes(32).toString("hex");
  const manageTokenHash = createHash("sha256").update(manageToken).digest("hex");

  const locationText =
    input.locationType === "on_site" ? input.propertyAddress! : "Springfield office";

  let bookingId: string;
  try {
    bookingId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(bookings)
        .values({
          creatorId: creator.id,
          agentId: agent.id,
          source: "agent",
          shootType: input.shootType,
          locationType: input.locationType,
          projectName: input.projectName,
          propertyAddress:
            input.locationType === "on_site" ? input.propertyAddress : null,
          notes: input.notes ?? null,
          startsAt: new Date(slot.start),
          endsAt: new Date(slot.end),
          status: "confirmed",
          manageTokenHash,
          googleCalendarId: creator.calendarEmail,
        })
        .returning({ id: bookings.id });

      // Calendar write inside the transaction: a Google failure aborts the
      // booking entirely (§B5.2 — never DB-only bookings).
      const eventId = await insertBookingEvent({
        creatorEmail: creator.calendarEmail!,
        bookingId: row.id,
        summary: `Shoot: ${agent.name} — ${dbShootTypeLabel[input.shootType]} · ${input.projectName}`,
        location: locationText,
        description: [
          "Booked via ContentApp",
          `Agent: ${agent.name}${agent.phone ? ` (${agent.phone})` : ""}`,
          `Type: ${dbShootTypeLabel[input.shootType]}`,
          `Project: ${input.projectName}`,
          input.notes ? `Notes: ${input.notes}` : null,
          `Booking ID: ${row.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        startIso: slot.start,
        endIso: slot.end,
        agentEmail: agent.email,
        timeZone: TZ,
      });

      await tx
        .update(bookings)
        .set({ googleEventId: eventId })
        .where(eq(bookings.id, row.id));

      return row.id;
    });
  } catch (e) {
    // Exclusion-constraint violation = another agent won the race.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "23P01"
    ) {
      return jsonError(409, "That slot was just taken — please pick another time.");
    }
    console.error("Booking creation failed:", e);
    return jsonError(503, "The booking couldn't be completed — the slot was not taken. Please try again.");
  }

  await logAudit({
    entity: "booking",
    entityId: bookingId,
    action: "create",
    diff: {
      creator: creator.name,
      agent: agent.name,
      start: slot.start,
      shootType: input.shootType,
      project: input.projectName,
    },
  });

  const origin = new URL(req.url).origin;
  const manageUrl = `${origin}/booking/${bookingId}?token=${manageToken}`;
  const whenText = `${dayjs(slot.start).tz(TZ).format("dddd D MMMM, h:mm A")}–${dayjs(slot.end).tz(TZ).format("h:mm A")}`;

  if (agent.email) {
    await sendBookingConfirmation({
      to: agent.email,
      agentName: agent.name,
      creatorName: creator.name,
      projectName: input.projectName,
      whenText,
      locationText,
      manageUrl,
    });
  }

  return NextResponse.json(
    {
      id: bookingId,
      start: slot.start,
      end: slot.end,
      manageUrl,
      creatorName: creator.name,
      agentName: agent.name,
    },
    { status: 201 }
  );
}
