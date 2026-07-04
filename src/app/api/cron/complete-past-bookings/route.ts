// GET /api/cron/complete-past-bookings — evening cron (§B5.5): confirmed
// bookings whose end has passed become completed. Creators can still record
// overtime afterwards from their schedule.

import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "Unauthorized");
  }

  const updated = await db
    .update(bookings)
    .set({ status: "completed", updatedAt: sql`now()` })
    .where(and(eq(bookings.status, "confirmed"), lt(bookings.endsAt, sql`now()`)))
    .returning({ id: bookings.id });

  return NextResponse.json({ completed: updated.length });
}
