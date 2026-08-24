// GET /api/me/kpis?month=YYYY-MM — the creator's own numbers + revision queue.

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, deliverables } from "@/db/schema";
import { computeKpis } from "@/lib/kpis";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const month =
    new URL(req.url).searchParams.get("month") ?? dayjs().format("YYYY-MM");
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "Invalid month");

  const all = await computeKpis(month);
  const mine = all.find((k) => k.creatorId === session.user.id) ?? null;

  const toPost = await db
    .select({
      id: deliverables.id,
      type: deliverables.type,
      url: deliverables.url,
      workDate: deliverables.workDate,
    })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.creatorId, session.user.id),
        eq(deliverables.reviewStatus, "approved"),
        eq(deliverables.isPosted, false)
      )
    );

  // Enough to tell one card from another: a creator with three videos back
  // from the same shoot saw three identical cards, and the comment alone
  // ("CHANGE FARM TO PALM PLEASE") names neither the video nor the shoot.
  // Shoot-tied work is identified by its booking's project, untied work by the
  // title the creator gave it — the same coalesce the review queue does.
  const revisions = await db
    .select({
      id: deliverables.id,
      type: deliverables.type,
      url: deliverables.url,
      comment: deliverables.reviewComment,
      permit: deliverables.permitNumber, // editable on resubmit; required on videos
      imageCount: deliverables.imageCount, // same, for photos
      workDate: deliverables.workDate,
      projectName: bookings.projectName,
      title: deliverables.title,
      agentName: agents.fullName,
    })
    .from(deliverables)
    .leftJoin(bookings, eq(bookings.id, deliverables.bookingId))
    .leftJoin(agents, eq(agents.id, deliverables.agentId))
    .where(
      and(
        eq(deliverables.creatorId, session.user.id),
        eq(deliverables.reviewStatus, "needs_revision")
      )
    )
    // Now that the cards carry dates, they need a stable order to be read as a
    // list rather than a reshuffling pile.
    .orderBy(desc(deliverables.workDate));

  // Shoots that still owe videos — a reminder to finish submitting.
  const outstandingRows = await db
    .select({
      id: bookings.id,
      start: bookings.startsAt,
      projectName: bookings.projectName,
      agentName: agents.fullName,
      expectedVideos: bookings.expectedVideos,
      submittedVideos: sql<number>`(select count(*)::int from deliverables d where d.booking_id = ${bookings.id} and d.type = 'video_shoot')`,
    })
    .from(bookings)
    .leftJoin(agents, eq(agents.id, bookings.agentId))
    .where(
      and(
        eq(bookings.creatorId, session.user.id),
        sql`${bookings.expectedVideos} > (select count(*) from deliverables d where d.booking_id = ${bookings.id} and d.type = 'video_shoot')`
      )
    )
    .orderBy(bookings.startsAt);
  const outstanding = outstandingRows.map((r) => ({
    ...r,
    start: r.start.toISOString(),
  }));

  return NextResponse.json({ month, kpis: mine, revisions, toPost, outstanding });
}
