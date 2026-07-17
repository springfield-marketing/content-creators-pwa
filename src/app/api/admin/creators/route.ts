// GET /api/admin/creators — creators with settings + upcoming time off.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { arrayContains, asc, gte } from "drizzle-orm";
import { db } from "@/db";
import { creatorTimeOff, users } from "@/db/schema";

export async function GET() {
  const creators = await db
    .select({
      id: users.id,
      name: users.fullName,
      slug: users.slug,
      branch: users.branch,
      isActive: users.isActive,
      workingHours: users.workingHours,
      shootDurations: users.shootDurations,
      bufferMinutes: users.bufferMinutes,
      minNoticeHours: users.minNoticeHours,
      maxHorizonDays: users.maxHorizonDays,
      maxShootsPerDay: users.maxShootsPerDay,
    })
    .from(users)
    .where(arrayContains(users.roles, ["creator"]))
    .orderBy(asc(users.fullName));

  const timeOff = await db
    .select({
      id: creatorTimeOff.id,
      creatorId: creatorTimeOff.creatorId,
      from: creatorTimeOff.startsOn,
      to: creatorTimeOff.endsOn,
      reason: creatorTimeOff.reason,
    })
    .from(creatorTimeOff)
    .where(gte(creatorTimeOff.endsOn, dayjs().format("YYYY-MM-DD")));

  return NextResponse.json(
    creators.map((c) => ({
      ...c,
      timeOff: timeOff.filter((t) => t.creatorId === c.id),
    }))
  );
}
