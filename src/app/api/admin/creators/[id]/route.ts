// PATCH /api/admin/creators/[id] — booking-shaping settings (screen 13).
// Config changes affect future availability only (§B12.3).

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, arrayContains, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { jsonError, parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const timeRange = z.tuple([
  z.string().regex(/^\d{2}:\d{2}$/),
  z.string().regex(/^\d{2}:\d{2}$/),
]);
const schema = z
  .object({
    workingHours: z.partialRecord(
      z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      z.array(timeRange).max(4)
    ),
    shootDurations: z.object({
      photo: z.number().int().min(15).max(600),
      video: z.number().int().min(15).max(600),
      photo_video: z.number().int().min(15).max(600),
    }),
    bufferMinutes: z.number().int().min(0).max(240),
    minNoticeHours: z.number().int().min(0).max(240),
    maxHorizonDays: z.number().int().min(1).max(365),
    maxShootsPerDay: z.number().int().min(1).max(20),
    branch: z.string().trim().max(60),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Empty update" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(and(eq(users.id, id), arrayContains(users.roles, ["creator"])))
    .returning({ id: users.id });
  if (!updated) return jsonError(404, "Creator not found");

  await logAudit({
    entity: "creator_settings",
    entityId: id,
    action: "update",
    actorId: session.user.id,
    diff: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
