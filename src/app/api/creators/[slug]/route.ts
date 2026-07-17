// GET /api/creators/[slug] — one creator's public booking profile:
// settings that shape availability plus time off. No tokens or channel state.

import { NextResponse } from "next/server";
import { and, arrayContains, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { creatorTimeOff, users } from "@/db/schema";
import { jsonError } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const [creator] = await db
    .select({
      id: users.id,
      slug: users.slug,
      name: users.fullName,
      isActive: users.isActive,
      workingHours: users.workingHours,
      shootDurations: users.shootDurations,
      bufferMinutes: users.bufferMinutes,
      minNoticeHours: users.minNoticeHours,
      maxHorizonDays: users.maxHorizonDays,
      maxShootsPerDay: users.maxShootsPerDay,
    })
    .from(users)
    .where(and(eq(users.slug, slug), arrayContains(users.roles, ["creator"])))
    .limit(1);

  if (!creator || !creator.isActive) {
    return jsonError(404, "Creator not found");
  }

  const today = new Date().toISOString().slice(0, 10);
  const timeOff = await db
    .select({
      from: creatorTimeOff.startsOn,
      to: creatorTimeOff.endsOn,
    })
    .from(creatorTimeOff)
    .where(
      and(eq(creatorTimeOff.creatorId, creator.id), gte(creatorTimeOff.endsOn, today))
    );

  return NextResponse.json({ ...creator, timeOff });
}
