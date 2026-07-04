// Secure manage-link token handling (§B12.1): only the sha256 hash is
// stored; comparison is constant-time; tokens die with the booking.

import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, bookings, users } from "@/db/schema";

export async function bookingByToken(bookingId: string, token: string) {
  const [b] = await db
    .select({
      id: bookings.id,
      creatorId: bookings.creatorId,
      agentId: bookings.agentId,
      creatorName: users.fullName,
      creatorSlug: users.slug,
      calendarEmail: bookings.googleCalendarId,
      eventId: bookings.googleEventId,
      agentName: agents.fullName,
      agentEmail: agents.email,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      shootType: bookings.shootType,
      projectName: bookings.projectName,
      locationType: bookings.locationType,
      propertyAddress: bookings.propertyAddress,
      notes: bookings.notes,
      status: bookings.status,
      tokenHash: bookings.manageTokenHash,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.creatorId))
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(and(eq(bookings.id, bookingId)))
    .limit(1);

  if (!b || !b.tokenHash || !token) return null;
  const given = createHash("sha256").update(token).digest();
  const stored = Buffer.from(b.tokenHash, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return null;
  }
  // §B12.1: token is only valid while the booking is active.
  if (b.status !== "confirmed") return null;
  return b;
}
