// Weekly plan (screen: /admin/schedule).
// GET  ?week=YYYY-MM-DD (a Monday) — every creator's plan for that week.
// PUT  { week, rows: [{creatorId, planned, role, workingHours|null}] }
//      Refuses roles that conflict with existing confirmed agent bookings
//      in that week (same mandatory-resolution model as time off, §B12.2).

import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { and, arrayContains, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, creatorWeekSchedules, users } from "@/db/schema";
import { roleAllows, type WeekRole } from "@/lib/availability";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const isMonday = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && dayjs(d).day() === 1;

export async function GET(req: Request) {
  const week = new URL(req.url).searchParams.get("week") ?? "";
  if (!isMonday(week)) return jsonError(400, "week must be a Monday (YYYY-MM-DD)");

  const creators = await db
    .select({
      id: users.id,
      name: users.fullName,
      isActive: users.isActive,
      defaultHours: users.workingHours,
    })
    .from(users)
    .where(arrayContains(users.roles, ["creator"]))
    .orderBy(asc(users.fullName));

  const plans = await db
    .select({
      creatorId: creatorWeekSchedules.creatorId,
      role: creatorWeekSchedules.role,
      workingHours: creatorWeekSchedules.workingHours,
    })
    .from(creatorWeekSchedules)
    .where(eq(creatorWeekSchedules.weekStart, week));
  const byCreator = new Map(plans.map((p) => [p.creatorId, p]));

  return NextResponse.json({
    week,
    rows: creators
      .filter((c) => c.isActive)
      .map((c) => {
        const p = byCreator.get(c.id);
        return {
          creatorId: c.id,
          creatorName: c.name,
          planned: !!p,
          role: p?.role ?? "all",
          workingHours: p?.workingHours ?? null,
          defaultHours: c.defaultHours,
        };
      }),
  });
}

const timeRange = z.tuple([
  z.string().regex(/^\d{2}:\d{2}$/),
  z.string().regex(/^\d{2}:\d{2}$/),
]);
const putSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z
    .array(
      z.object({
        creatorId: z.string().uuid(),
        planned: z.boolean(),
        role: z.enum(["all", "photo_only", "video_only", "company_only"]),
        // partialRecord: days off are simply absent — a plain record would
        // demand all seven weekdays and reject every real week plan.
        workingHours: z
          .partialRecord(
            z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
            z.array(timeRange).max(4)
          )
          .nullable(),
      })
    )
    .min(1),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, putSchema);
  if ("error" in parsed) return parsed.error;
  const { week, rows } = parsed.data;
  if (!isMonday(week)) return jsonError(400, "week must be a Monday");

  // Conflict check: confirmed AGENT bookings that the new role would forbid.
  const weekStart = dayjs(week).startOf("day").toDate();
  const weekEnd = dayjs(week).add(7, "day").startOf("day").toDate();
  const creatorIds = rows.map((r) => r.creatorId);
  const existing = creatorIds.length
    ? await db
        .select({
          id: bookings.id,
          creatorId: bookings.creatorId,
          start: bookings.startsAt,
          shootType: bookings.shootType,
          projectName: bookings.projectName,
          agentName: agents.fullName,
        })
        .from(bookings)
        .leftJoin(agents, eq(agents.id, bookings.agentId))
        .where(
          and(
            inArray(bookings.creatorId, creatorIds),
            eq(bookings.status, "confirmed"),
            ne(bookings.source, "company"),
            gte(bookings.startsAt, weekStart),
            lt(bookings.startsAt, weekEnd)
          )
        )
    : [];

  const conflicts = existing
    .filter((b) => {
      const row = rows.find((r) => r.creatorId === b.creatorId);
      if (!row || !row.planned) return false;
      return !roleAllows(row.role as WeekRole, b.shootType);
    })
    .map((b) => ({
      id: b.id,
      creatorId: b.creatorId,
      start: b.start.toISOString(),
      shootType: b.shootType,
      projectName: b.projectName,
      agentName: b.agentName,
    }));
  if (conflicts.length > 0) {
    return NextResponse.json(
      {
        error:
          "Some existing bookings don't fit the new roles — reassign or cancel them first.",
        conflicts,
      },
      { status: 409 }
    );
  }

  for (const r of rows) {
    if (!r.planned) {
      await db
        .delete(creatorWeekSchedules)
        .where(
          and(
            eq(creatorWeekSchedules.creatorId, r.creatorId),
            eq(creatorWeekSchedules.weekStart, week)
          )
        );
      continue;
    }
    await db
      .insert(creatorWeekSchedules)
      .values({
        creatorId: r.creatorId,
        weekStart: week,
        role: r.role,
        workingHours: r.workingHours,
        createdBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [creatorWeekSchedules.creatorId, creatorWeekSchedules.weekStart],
        set: {
          role: r.role,
          workingHours: r.workingHours,
          createdBy: session.user.id,
        },
      });
  }

  await logAudit({
    entity: "week_plan",
    entityId: session.user.id,
    action: "set",
    actorId: session.user.id,
    diff: { week, planned: rows.filter((r) => r.planned).length },
  });

  return NextResponse.json({ ok: true });
}
