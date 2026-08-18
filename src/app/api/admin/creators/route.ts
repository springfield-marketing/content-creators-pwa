// GET /api/admin/creators — creators with settings + upcoming time off.
// POST /api/admin/creators — add a creator (multipart: details + optional photo).

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { z } from "zod";
import { put } from "@vercel/blob";
import { arrayContains, asc, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creatorTimeOff, users } from "@/db/schema";
import { freeBusy } from "@/lib/google-calendar";
import { jsonError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const creators = await db
    .select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      photoUrl: users.photoUrl,
      slug: users.slug,
      branch: users.branch,
      craft: users.craft,
      roles: users.roles,
      isActive: users.isActive,
      resignedOn: users.resignedOn,
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

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const createSchema = z.object({
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
  branch: z.string().trim().min(1).max(60),
});

// "Sean Chase Reyes Laihee" -> "sean-chase-reyes-laihee" (matches existing rows).
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected a multipart form body");
  }

  const parsed = createSchema.safeParse({
    fullName: form.get("fullName"),
    email: form.get("email"),
    branch: form.get("branch"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }
  const { fullName, email, branch } = parsed.data;

  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    if (!photo.type.startsWith("image/")) {
      return jsonError(415, "Photo must be an image file");
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return jsonError(413, "Photo must be 5MB or smaller");
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return jsonError(
        503,
        "Photo uploads aren't configured yet — create a Vercel Blob store and set BLOB_READ_WRITE_TOKEN, or add the creator without a photo."
      );
    }
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  // A resigned creator releases their address, so a collision here always
  // means a current account. Reactivating is deliberately not offered: these
  // mailboxes are handed on, so the same address is usually a different person.
  if (existing) {
    return jsonError(409, "This email is already in use by an active account.");
  }

  const slug = slugify(fullName);
  const [slugTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.slug, slug))
    .limit(1);
  if (slugTaken) {
    return jsonError(409, `The booking link /book/${slug} is already taken.`);
  }

  // Blob first, then DB — an upload failure aborts before we create the row
  // (same ordering rule as calendar-then-DB in booking-actions).
  let photoUrl: string | null = null;
  if (hasPhoto) {
    const file = photo as File;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    try {
      const blob = await put(`creators/${slug}.${ext}`, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      });
      photoUrl = blob.url;
    } catch (e) {
      return jsonError(
        502,
        `Photo upload failed: ${e instanceof Error ? e.message : "unknown error"}`
      );
    }
  }

  const [{ next: sortOrder }] = await db
    .select({ next: sql<number>`coalesce(max(${users.sortOrder}), 0) + 1` })
    .from(users);

  const [created] = await db
    .insert(users)
    .values({
      email,
      fullName,
      roles: ["creator"],
      slug,
      branch,
      photoUrl,
      sortOrder,
      googleCalendarId: email, // creators book onto their own Workspace calendar
    })
    .returning({ id: users.id });

  // Non-blocking: a creator whose calendar isn't delegated yet still gets
  // created, but the manager is told before an agent hits it at booking time.
  let calendarOk = true;
  try {
    const now = new Date();
    await freeBusy(
      email,
      now.toISOString(),
      new Date(now.getTime() + 24 * 3600 * 1000).toISOString()
    );
  } catch {
    calendarOk = false;
  }

  await logAudit({
    entity: "user",
    entityId: created.id,
    action: "creator_add",
    actorId: session.user.id,
    diff: { email, fullName, branch, slug, hasPhoto, calendarOk },
  });

  return NextResponse.json(
    { id: created.id, slug, calendarOk },
    { status: 201 }
  );
}
