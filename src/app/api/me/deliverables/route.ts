// POST /api/me/deliverables — log a deliverable (screen 6). It enters the
// review queue as 'submitted'.

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { bookings, deliverables } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  bookingId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  type: z.enum(["photo_shoot", "video_shoot"]),
  url: z.string().url().max(2000),
  platform: z.enum(["instagram", "tiktok", "drive", "dropbox", "other"]),
  posted: z.boolean(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  let agentId = input.agentId ?? null;
  if (input.bookingId) {
    const [b] = await db
      .select({ agentId: bookings.agentId })
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
  }

  const [created] = await db
    .insert(deliverables)
    .values({
      creatorId: session.user.id,
      bookingId: input.bookingId ?? null,
      agentId,
      type: input.type,
      platform: input.platform,
      url: input.url,
      isPosted: input.posted,
      postedAt: input.posted ? new Date() : null,
      workDate: input.workDate,
    })
    .returning({ id: deliverables.id });

  await logAudit({
    entity: "deliverable",
    entityId: created.id,
    action: "create",
    actorId: session.user.id,
    diff: { type: input.type, url: input.url, bookingId: input.bookingId },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
