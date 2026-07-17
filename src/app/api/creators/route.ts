// GET /api/creators — active creators for the public booking page.
// §B12.2: creators currently on leave are hidden entirely, not shown-but-full.

import { NextResponse } from "next/server";
import { and, arrayContains, asc, eq, gte, lte, notExists, sql } from "drizzle-orm";
import dayjs from "dayjs";
import { db } from "@/db";
import { creatorTimeOff, users } from "@/db/schema";

export async function GET() {
  const today = dayjs().format("YYYY-MM-DD");

  const rows = await db
    .select({
      id: users.id,
      slug: users.slug,
      name: users.fullName,
      photoUrl: users.photoUrl,
      branch: users.branch,
    })
    .from(users)
    .where(
      and(
        arrayContains(users.roles, ["creator"]),
        eq(users.isActive, true),
        notExists(
          db
            .select({ id: creatorTimeOff.id })
            .from(creatorTimeOff)
            .where(
              and(
                eq(creatorTimeOff.creatorId, users.id),
                lte(creatorTimeOff.startsOn, today),
                gte(creatorTimeOff.endsOn, today)
              )
            )
        )
      )
    )
    .orderBy(sql`${users.sortOrder} NULLS LAST`, asc(users.fullName));

  return NextResponse.json(rows);
}
