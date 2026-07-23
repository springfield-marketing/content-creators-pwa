// GET /api/admin/bookings?from&to — all creators' bookings for the week grid.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { agents, bookings, users } from "@/db/schema";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return jsonError(400, "from and to are required");

  const rows = await db
    .select({
      id: bookings.id,
      creatorId: bookings.creatorId,
      creatorName: users.fullName,
      agentName: agents.fullName,
      start: bookings.startsAt,
      end: bookings.endsAt,
      shootType: bookings.shootType,
      projectName: bookings.projectName,
      locationType: bookings.locationType,
      propertyAddress: bookings.propertyAddress,
      status: bookings.status,
      cancellationReason: bookings.cancellationReason,
      cancelledBy: bookings.cancelledBy,
      agentDeclined: bookings.agentDeclined,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.creatorId))
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(
      and(
        // Cancelled bookings free their slot — keep them off the week grid so
        // the cell reads as available. History lives in the booking's audit.
        ne(bookings.status, "cancelled"),
        gte(bookings.startsAt, dayjs(from).toDate()),
        lt(bookings.startsAt, dayjs(to).add(1, "day").toDate())
      )
    )
    .orderBy(bookings.startsAt);

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    }))
  );
}
