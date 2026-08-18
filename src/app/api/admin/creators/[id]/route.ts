// PATCH /api/admin/creators/[id] — booking-shaping settings (screen 13).
// Config changes affect future availability only (§B12.3).
// POST  /api/admin/creators/[id] — { action: "resign" }: they've left.
//                                  { action: "unresign" }: marked in error.

import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { and, arrayContains, eq, ne } from "drizzle-orm";
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
    // Identity, so a typo or a hand-over doesn't need a database edit.
    fullName: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(254)
      .refine((e) => e.endsWith("@springfield-re.com"), {
        message: "Must be a company Google account (@springfield-re.com)",
      }),
    craft: z.enum(["video", "photo", "both"]),
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

  // Email is both the sign-in and the calendar bookings land on — every creator
  // has the two identical — so a change has to be unique and move both.
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.email) {
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, parsed.data.email), ne(users.id, id)))
      .limit(1);
    if (clash) return jsonError(409, "That email is already in use.");
    patch.googleCalendarId = parsed.data.email;
  }

  const [updated] = await db
    .update(users)
    .set(patch)
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

// Resigning frees the shared mailbox for the next hire while leaving every
// booking, deliverable and review decision attached to this row. The address
// moves to former_email and email becomes a synthetic archive value, because
// users.email is UNIQUE and the replacement needs the real one.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = await parseBody(
    req,
    z.object({ action: z.enum(["resign", "unresign"]) })
  );
  if ("error" in parsed) return parsed.error;

  const [c] = await db
    .select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      slug: users.slug,
      isActive: users.isActive,
      resignedOn: users.resignedOn,
      formerEmail: users.formerEmail,
    })
    .from(users)
    .where(and(eq(users.id, id), arrayContains(users.roles, ["creator"])))
    .limit(1);
  if (!c) return jsonError(404, "Creator not found");

  // Reversing a resignation only works while nobody has taken the address back
  // — once a replacement holds it, the two would collide on a UNIQUE column.
  if (parsed.data.action === "unresign") {
    if (!c.resignedOn || !c.formerEmail) {
      return jsonError(409, "This creator hasn't resigned");
    }
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, c.formerEmail), ne(users.id, id)))
      .limit(1);
    if (taken) {
      return jsonError(
        409,
        `${c.formerEmail} now belongs to someone else, so it can't be handed back. Free it there first.`
      );
    }

    await db
      .update(users)
      .set({
        isActive: true,
        resignedOn: null,
        email: c.formerEmail,
        formerEmail: null,
        // The nightly cron reopens the calendar watch for any creator missing one.
        googleCalendarId: c.formerEmail,
      })
      .where(eq(users.id, id));

    await logAudit({
      entity: "user",
      entityId: id,
      action: "creator_resignation_reverted",
      actorId: session.user.id,
      diff: { name: c.name, restoredEmail: c.formerEmail },
    });

    return NextResponse.json({ ok: true, restoredEmail: c.formerEmail });
  }

  if (c.resignedOn) return jsonError(409, "This creator has already resigned");

  const today = dayjs().format("YYYY-MM-DD");
  // Slug is unique, so the archived address is too.
  const archived = `resigned+${c.slug ?? c.id}@springfield-re.com`;

  await db
    .update(users)
    .set({
      isActive: false,
      resignedOn: today,
      formerEmail: c.email,
      email: archived,
      // Stops the nightly watch-channel cron renewing a watch on a mailbox
      // that now belongs to somebody else.
      googleCalendarId: null,
      webhookChannelId: null,
      webhookResourceId: null,
      webhookExpiresAt: null,
      calendarSyncToken: null,
    })
    .where(eq(users.id, id));

  await logAudit({
    entity: "user",
    entityId: id,
    action: "creator_resigned",
    actorId: session.user.id,
    diff: { name: c.name, freedEmail: c.email, resignedOn: today },
  });

  return NextResponse.json({ ok: true, freedEmail: c.email });
}
