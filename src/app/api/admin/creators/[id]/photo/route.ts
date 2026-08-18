// POST /api/admin/creators/[id]/photo — replace a creator's booking-card photo.
// Multipart, like the create flow: the JSON PATCH alongside this handles every
// other field, and mixing a file upload into it would force both to multipart.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { and, arrayContains, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { jsonError } from "@/lib/api";
import { logAudit } from "@/lib/audit";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");

  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected a multipart form body");
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return jsonError(422, "Choose an image to upload");
  }
  if (!photo.type.startsWith("image/")) {
    return jsonError(415, "Photo must be an image file");
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return jsonError(413, "Photo must be 5MB or smaller");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonError(
      503,
      "Photo uploads aren't configured — set BLOB_READ_WRITE_TOKEN."
    );
  }

  const [creator] = await db
    .select({ id: users.id, slug: users.slug, photoUrl: users.photoUrl })
    .from(users)
    .where(and(eq(users.id, id), arrayContains(users.roles, ["creator"])))
    .limit(1);
  if (!creator) return jsonError(404, "Creator not found");

  // Blob first, then DB — a failed upload leaves the old photo in place rather
  // than pointing the card at nothing.
  const ext = photo.name.includes(".") ? photo.name.split(".").pop() : "jpg";
  let url: string;
  try {
    const blob = await put(`creators/${creator.slug ?? id}.${ext}`, photo, {
      access: "public",
      addRandomSuffix: true,
      contentType: photo.type,
    });
    url = blob.url;
  } catch (e) {
    return jsonError(
      502,
      `Photo upload failed: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  await db.update(users).set({ photoUrl: url }).where(eq(users.id, id));

  await logAudit({
    entity: "user",
    entityId: id,
    action: "creator_photo",
    actorId: session.user.id,
    // The previous URL is kept so a wrong upload can be pointed back.
    diff: { photoUrl: url, previousPhotoUrl: creator.photoUrl },
  });

  return NextResponse.json({ ok: true, photoUrl: url });
}
