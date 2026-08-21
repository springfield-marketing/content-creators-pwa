// POST /api/permits/issue — records a permit an admin has already paid for and
// downloaded from Trakheesi, with its QR images.
//
// Multipart rather than JSON: DLD issues four sized PNGs per permit and they
// arrive as files. Issuance itself stays manual — this app is the record, not
// the buyer.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { developers, permitFiles, permitRequests, permits, projects } from "@/db/schema";
import { jsonError } from "@/lib/api";
import { can } from "@/lib/registry/access";
import { validateIssue, validateNewProject } from "@/lib/registry/issue";
import { variantFromFileName } from "@/lib/registry/qr-import";
import { checkUpload, saveUpload } from "@/lib/registry/storage";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "issuePermit")) return jsonError(403, "Forbidden");

  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? "").trim();

  // Requests often name a project we do not track yet, so the same form can
  // create it. Everything downstream is identical once we have an id.
  const rawId = str("projectId");
  let projectId = Number(rawId);

  if (!rawId) {
    const proposed = validateNewProject({
      name: str("newName"),
      dldProjectNumber: str("newDldNumber"),
      developer: str("newDeveloper"),
      emirate: str("newEmirate"),
    });
    if (!proposed.ok) return jsonError(422, proposed.error);
    const { name, dldProjectNumber, developer, emirate } = proposed.value;

    // Refuse rather than create a second row for a project already tracked;
    // duplicate DLD numbers are how the source sheet went wrong.
    if (dldProjectNumber) {
      const [clash] = await db
        .select({ name: projects.nameEn })
        .from(projects)
        .where(eq(projects.dldProjectNumber, dldProjectNumber));
      if (clash) {
        return jsonError(
          409,
          `Project #${dldProjectNumber} is already tracked as "${clash.name}".`,
        );
      }
    }

    let developerId: number | null = null;
    if (developer) {
      const [existing] = await db
        .select({ id: developers.id })
        .from(developers)
        .where(eq(developers.nameEn, developer));
      developerId =
        existing?.id ??
        (
          await db
            .insert(developers)
            .values({ nameEn: developer })
            .returning({ id: developers.id })
        )[0].id;
    }

    const [created] = await db
      .insert(projects)
      .values({
        nameEn: name,
        dldProjectNumber,
        developerId,
        emirate,
        dldStatus: "active",
      })
      .returning({ id: projects.id });
    projectId = created.id;
  }

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return jsonError(422, "Unknown project.");
  }

  const requestId = Number(form.get("requestId"));
  const hasRequest = Number.isInteger(requestId) && requestId > 0;

  // Point the request at the project as soon as one exists. If a later step
  // fails, the request is still open but now attached, so a retry is an
  // ordinary issue rather than hitting the duplicate-project guard.
  if (hasRequest) {
    await db
      .update(permitRequests)
      .set({ projectId })
      .where(eq(permitRequests.id, requestId));
  }

  const parsed = validateIssue({
    permitNumber: str("permitNumber"),
    listingStart: str("listingStart"),
    listingEnd: str("listingEnd"),
  });
  if (!parsed.ok) return jsonError(422, parsed.error);
  const { permitNumber, listingStart, listingEnd } = parsed.value;

  const files = form
    .getAll("qr")
    .filter((f): f is File => f instanceof File && f.size > 0);

  for (const f of files) {
    const problem = checkUpload(f);
    if (problem) return jsonError(422, problem);
  }

  // Last one wins if the same variant is picked twice in one go.
  const byVariant = new Map<string, File>();
  for (const f of files) {
    byVariant.set(
      variantFromFileName(f.name) ?? f.name.replace(/\.[a-z0-9]+$/i, ""),
      f,
    );
  }

  // A new row rather than an update, so a renewal leaves last year's permit
  // intact and the history of what was valid when survives.
  const [permit] = await db
    .insert(permits)
    .values({
      projectId,
      permitNumber,
      listingStart,
      listingEnd,
      notes: str("notes") || null,
      issuedByEmail: session.user.email,
    })
    .returning();

  try {
    for (const [variant, file] of byVariant) {
      const url = await saveUpload(file, projectId, permitNumber, variant);
      await db
        .insert(permitFiles)
        .values({ permitId: permit.id, variant, fileName: file.name, url })
        .onConflictDoUpdate({
          target: [permitFiles.permitId, permitFiles.variant],
          set: { url, fileName: file.name },
        });
    }
  } catch (e) {
    // 207-ish: the permit IS recorded, so reporting a plain failure would have
    // the admin issue it a second time. Say what happened instead.
    console.error("[issue] upload failed", e);
    return NextResponse.json(
      {
        error: `Permit saved, but a file failed to upload: ${
          e instanceof Error ? e.message : String(e)
        }`,
        permitId: permit.id,
      },
      { status: 502 },
    );
  }

  // Only now is the request genuinely fulfilled: permit recorded, files stored.
  if (hasRequest) {
    await db
      .update(permitRequests)
      .set({ status: "issued", permitId: permit.id, resolvedAt: new Date() })
      .where(eq(permitRequests.id, requestId));
  }

  return NextResponse.json({ permitId: permit.id, projectId }, { status: 201 });
}
