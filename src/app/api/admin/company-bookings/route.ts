// POST /api/admin/company-bookings — manager-created company shoots.
// No agent, source='company', free-form times (manager's judgment); the
// exclusion constraint still prevents overlaps with confirmed bookings.

import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { insertBookingEvent } from "@/lib/google-calendar";
import { TZ } from "@/lib/availability";
import { dbShootTypeLabel } from "@/lib/shoot-types";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  creatorId: z.string().uuid(),
  shootType: z.enum(["photo", "video", "photo_video"]),
  start: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(720),
  projectName: z.string().trim().min(1).max(200),
  locationType: z.enum(["on_site", "office"]),
  propertyAddress: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  const [creator] = await db
    .select({
      id: users.id,
      name: users.fullName,
      calendarEmail: users.googleCalendarId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, input.creatorId),
        eq(users.role, "creator"),
        eq(users.isActive, true)
      )
    )
    .limit(1);
  if (!creator?.calendarEmail) return jsonError(404, "Creator not found");

  if (dayjs(input.start).isBefore(dayjs())) {
    return jsonError(422, "Company shoots must be in the future");
  }
  const start = dayjs(input.start);
  const end = start.add(input.durationMinutes, "minute");
  const locationText =
    input.locationType === "on_site"
      ? (input.propertyAddress ?? "")
      : "Springfield office";

  let bookingId: string;
  try {
    bookingId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(bookings)
        .values({
          creatorId: creator.id,
          agentId: null,
          source: "company",
          shootType: input.shootType,
          locationType: input.locationType,
          projectName: input.projectName,
          propertyAddress:
            input.locationType === "on_site" ? input.propertyAddress : null,
          notes: input.notes ?? null,
          startsAt: start.toDate(),
          endsAt: end.toDate(),
          status: "confirmed",
          googleCalendarId: creator.calendarEmail,
        })
        .returning({ id: bookings.id });

      const eventId = await insertBookingEvent({
        creatorEmail: creator.calendarEmail!,
        bookingId: row.id,
        summary: `Company shoot: ${input.projectName} (${dbShootTypeLabel[input.shootType]})`,
        location: locationText,
        description: [
          "Company shoot — booked via ContentApp",
          `Type: ${dbShootTypeLabel[input.shootType]}`,
          `Project: ${input.projectName}`,
          input.notes ? `Notes: ${input.notes}` : null,
          `Booking ID: ${row.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        agentEmail: null,
        timeZone: TZ,
      });
      await tx
        .update(bookings)
        .set({ googleEventId: eventId })
        .where(eq(bookings.id, row.id));
      return row.id;
    });
  } catch (e) {
    if (
      typeof e === "object" && e !== null && "code" in e &&
      (e as { code?: string }).code === "23P01"
    ) {
      return jsonError(409, `${creator.name} already has a booking overlapping that time`);
    }
    console.error("Company booking failed:", e);
    return jsonError(503, "The booking couldn't be completed — nothing was created.");
  }

  await logAudit({
    entity: "booking",
    entityId: bookingId,
    action: "create_company",
    actorId: session.user.id,
    diff: { creator: creator.name, start: start.toISOString(), project: input.projectName },
  });

  return NextResponse.json({ id: bookingId }, { status: 201 });
}
