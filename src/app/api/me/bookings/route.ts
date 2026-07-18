// GET /api/me/bookings — the signed-in creator's schedule (last 7 days +
// everything upcoming), with pending-cancellation flags.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, cancellationRequests } from "@/db/schema";
import { jsonError } from "@/lib/api";

export async function GET() {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const rows = await db
    .select({
      id: bookings.id,
      start: bookings.startsAt,
      end: bookings.endsAt,
      actualEnd: bookings.actualEndsAt,
      shootType: bookings.shootType,
      projectName: bookings.projectName,
      locationType: bookings.locationType,
      propertyAddress: bookings.propertyAddress,
      notes: bookings.notes,
      status: bookings.status,
      agentName: agents.fullName,
      agentDeclined: bookings.agentDeclined,
      expectedVideos: bookings.expectedVideos,
      submittedVideos: sql<number>`(select count(*)::int from deliverables d where d.booking_id = ${bookings.id} and d.type = 'video_shoot')`,
    })
    .from(bookings)
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(
      and(
        eq(bookings.creatorId, session.user.id),
        // Recent shoots, plus any shoot that still owes videos — so a
        // partially-delivered shoot stays selectable past the 7-day window.
        or(
          gte(bookings.endsAt, dayjs().subtract(7, "day").toDate()),
          sql`${bookings.expectedVideos} > (select count(*) from deliverables d where d.booking_id = ${bookings.id} and d.type = 'video_shoot')`
        )
      )
    )
    .orderBy(bookings.startsAt);

  const ids = rows.map((r) => r.id);
  const pending = ids.length
    ? await db
        .select({ bookingId: cancellationRequests.bookingId })
        .from(cancellationRequests)
        .where(
          and(
            inArray(cancellationRequests.bookingId, ids),
            eq(cancellationRequests.status, "pending")
          )
        )
    : [];
  const pendingSet = new Set(pending.map((p) => p.bookingId));

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      actualEnd: r.actualEnd?.toISOString() ?? null,
      pendingCancellation: pendingSet.has(r.id),
    }))
  );
}
