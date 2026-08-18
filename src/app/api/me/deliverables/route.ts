// POST /api/me/deliverables — log a deliverable (screen 6). It enters the
// review queue as 'submitted'.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { auth } from "@/auth";
import { db } from "@/db";
import { agents, bookings, deliverables, users } from "@/db/schema";
import { TZ } from "@/lib/availability";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

dayjs.extend(utc);
dayjs.extend(timezone);

const schema = z.object({
  bookingId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  type: z.enum(["photo_shoot", "video_shoot"]),
  url: z.string().url().max(2000),
  platform: z.enum(["instagram", "tiktok", "drive", "dropbox", "other"]),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Total videos this shoot should yield — declared on the first video submit,
  // adjustable on later ones (last write wins). Only meaningful when tied to a
  // shoot; ignored otherwise.
  expectedVideos: z.number().int().min(1).max(20).optional(),
  // A name for the deliverable, required when it isn't tied to a shoot (a
  // shoot-tied one is identified by its booking's project).
  title: z.string().trim().min(1).max(200).optional(),
  // Media permit, supplied per video by the creator who filmed it. Required
  // for videos (enforced below); free text — real permits vary in format.
  permitNumber: z.string().trim().min(1).max(100).optional(),
  // A shoot that was never booked. Recording it here creates the booking so
  // the deliverable has something to hang off, rather than floating untied:
  // 'company' is internal work with no agent, 'client' is work for an agent
  // that simply never came through the booking flow.
  recordShoot: z.enum(["company", "client"]).optional(),
  // How many images the folder holds. Required for photos (enforced below) —
  // it's the only measure of photo volume, since a shoot is one folder link.
  imageCount: z.number().int().min(0).max(10000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  // No shoot to inherit a name from, so the creator supplies one.
  if (!input.bookingId && !input.title) {
    return jsonError(422, "A title is required when not tied to a shoot");
  }
  if (input.type === "video_shoot" && !input.permitNumber) {
    return jsonError(422, "A permit number is required for videos");
  }
  if (input.type === "photo_shoot" && input.imageCount == null) {
    return jsonError(422, "An image count is required for photo shoots");
  }

  let agentId = input.agentId ?? null;
  let bookingId = input.bookingId ?? null;

  // Company shoots are logged after the fact, so the booking is written as
  // already completed: no calendar event for something that has happened, and
  // 'completed' sits outside the no-overlap constraint, which only guards
  // confirmed bookings. Times come from the creator's own configured duration
  // for that shoot type — enough to place the shoot on the day it happened.
  if (input.recordShoot && !bookingId) {
    const isClient = input.recordShoot === "client";
    if (isClient && !input.agentId) {
      return jsonError(422, "Choose the agent this shoot was for");
    }
    if (isClient) {
      const [a] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.id, input.agentId!), eq(agents.isActive, true)))
        .limit(1);
      if (!a) return jsonError(404, "Agent not found");
    }

    const [me] = await db
      .select({ shootDurations: users.shootDurations })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const shootType = input.type === "photo_shoot" ? "photo" : "video";
    const minutes = me?.shootDurations?.[shootType] ?? 120;
    const startsAt = dayjs.tz(`${input.workDate} 10:00`, TZ).toDate();
    const endsAt = dayjs(startsAt).add(minutes, "minute").toDate();

    const [created] = await db
      .insert(bookings)
      .values({
        creatorId: session.user.id,
        agentId: isClient ? input.agentId! : null,
        // 'manual' marks a client shoot recorded after the fact, so it stays
        // distinguishable from one the agent booked properly.
        source: isClient ? "manual" : "company",
        shootType,
        // No address was captured, so on_site is left unqualified for client
        // work; a manager can correct it on the booking.
        locationType: isClient ? "on_site" : "office",
        projectName: input.title!,
        startsAt,
        endsAt,
        status: "completed",
      })
      .returning({ id: bookings.id });
    bookingId = created.id;
    agentId = isClient ? input.agentId! : null;

    await logAudit({
      entity: "booking",
      entityId: created.id,
      action: isClient ? "create_unbooked_client" : "create_company",
      actorId: session.user.id,
      diff: {
        projectName: input.title,
        source: isClient ? "manual" : "company",
        loggedByCreator: true,
      },
    });
  }

  if (input.bookingId) {
    const [b] = await db
      .select({ agentId: bookings.agentId, expectedVideos: bookings.expectedVideos })
      .from(bookings)
      .where(
        and(
          eq(bookings.id, input.bookingId),
          eq(bookings.creatorId, session.user.id)
        )
      )
      .limit(1);
    if (!b) return jsonError(404, "Shoot not found");
    agentId = b.agentId; // shoot-tied deliverables inherit the agent

    // The form asks for the shoot's video total once, when the shoot doesn't
    // have one yet, and disables submit without it — but the server said
    // optional, so anything not going through the form could skip it and
    // silently break the "2 of 3 from this shoot" count. Same rule, enforced.
    if (
      input.type === "video_shoot" &&
      b.expectedVideos == null &&
      input.expectedVideos == null
    ) {
      return jsonError(
        422,
        "Say how many videos this shoot should produce in total"
      );
    }

    // Record how many videos this shoot should yield, so later submissions
    // (and the manager) can see what's still outstanding.
    if (input.type === "video_shoot" && input.expectedVideos != null) {
      await db
        .update(bookings)
        .set({ expectedVideos: input.expectedVideos })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.creatorId, session.user.id)
          )
        );
    }
  }

  const [created] = await db
    .insert(deliverables)
    .values({
      creatorId: session.user.id,
      bookingId,
      agentId,
      type: input.type,
      platform: input.platform,
      url: input.url,
      title: input.title ?? null,
      permitNumber: input.permitNumber ?? null,
      imageCount: input.imageCount ?? null,
      // Workflow: posting happens AFTER approval; creators mark it from
      // their progress screen once the manager approves.
      isPosted: false,
      workDate: input.workDate,
    })
    .returning({ id: deliverables.id });

  await logAudit({
    entity: "deliverable",
    entityId: created.id,
    action: "create",
    actorId: session.user.id,
    diff: {
      type: input.type,
      url: input.url,
      bookingId,
      permitNumber: input.permitNumber ?? null,
      imageCount: input.imageCount ?? null,
    },
  });

  // Returned so a multi-link submit reuses the company booking made by the
  // first link instead of creating one per video.
  return NextResponse.json({ id: created.id, bookingId }, { status: 201 });
}
