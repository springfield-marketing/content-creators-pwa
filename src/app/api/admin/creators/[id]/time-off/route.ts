// Time off (§B12.2). GET ?from&to lists conflicting confirmed bookings;
// POST refuses to save while conflicts remain unresolved (mandatory flow).

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, lt } from "drizzle-orm";
import dayjs from "dayjs";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, creatorTimeOff } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

async function conflictsFor(creatorId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: bookings.id,
      start: bookings.startsAt,
      end: bookings.endsAt,
      projectName: bookings.projectName,
      shootType: bookings.shootType,
      agentName: agents.fullName,
    })
    .from(bookings)
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(
      and(
        eq(bookings.creatorId, creatorId),
        eq(bookings.status, "confirmed"),
        gte(bookings.startsAt, dayjs(from).startOf("day").toDate()),
        lt(bookings.startsAt, dayjs(to).add(1, "day").startOf("day").toDate())
      )
    )
    .orderBy(bookings.startsAt);
  return rows.map((r) => ({
    ...r,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
  }));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return jsonError(400, "from and to are required");
  return NextResponse.json({ conflicts: await conflictsFor(id, from, to) });
}

const postSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(200),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, postSchema);
  if ("error" in parsed) return parsed.error;
  const { from, to, reason } = parsed.data;
  if (to < from) return jsonError(422, "Leave end is before its start");

  // §B12.2: cannot save while confirmed bookings remain in the range.
  const conflicts = await conflictsFor(id, from, to);
  if (conflicts.length > 0) {
    return NextResponse.json(
      {
        error: "Resolve the conflicting bookings first (reassign or cancel).",
        conflicts,
      },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(creatorTimeOff)
    .values({
      creatorId: id,
      startsOn: from,
      endsOn: to,
      reason,
      createdBy: session.user.id,
    })
    .returning({ id: creatorTimeOff.id });

  await logAudit({
    entity: "creator_time_off",
    entityId: created.id,
    action: "create",
    actorId: session.user.id,
    diff: { creatorId: id, from, to, reason },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const entryId = new URL(req.url).searchParams.get("entryId");
  if (!entryId) return jsonError(400, "entryId is required");

  const [deleted] = await db
    .delete(creatorTimeOff)
    .where(
      and(eq(creatorTimeOff.id, entryId), eq(creatorTimeOff.creatorId, id))
    )
    .returning({ id: creatorTimeOff.id });
  if (!deleted) return jsonError(404, "Entry not found");

  await logAudit({
    entity: "creator_time_off",
    entityId: entryId,
    action: "delete",
    actorId: session.user.id,
  });
  return NextResponse.json({ ok: true });
}
