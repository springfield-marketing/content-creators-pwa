// POST /api/permits/issue — records a permit an admin has already paid for and
// downloaded from Trakheesi, with its QR images.
//
// Multipart rather than JSON: DLD issues four sized PNGs per permit and they
// arrive as files. Issuance itself stays manual — this app is the record, not
// the buyer.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { developers, permitFiles, permitRequests, permits, projects } from "@/db/schema";
import { jsonError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { digitsOnly } from "@/lib/general-permits";
import { can } from "@/lib/registry/access";
import { validateIssue, validateNewProject } from "@/lib/registry/issue";
import { variantFromFileName } from "@/lib/registry/qr-import";
import { checkUpload, saveUpload } from "@/lib/registry/storage";
import { isEmirate } from "@/lib/registry/authority";

/**
 * Files under the "qr" key, keyed by the variant their filename names.
 *
 * Last one wins if the same variant is picked twice in one go.
 */
function qrFilesFrom(form: FormData): Map<string, File> | string {
  const files = form
    .getAll("qr")
    .filter((f): f is File => f instanceof File && f.size > 0);

  for (const f of files) {
    const problem = checkUpload(f);
    if (problem) return problem;
  }

  const byVariant = new Map<string, File>();
  for (const f of files) {
    byVariant.set(
      variantFromFileName(f.name) ?? f.name.replace(/\.[a-z0-9]+$/i, ""),
      f,
    );
  }
  return byVariant;
}

/** Writes the uploads and points the permit at them. Throws on upload failure. */
async function saveQrFiles(
  byVariant: Map<string, File>,
  permitId: number,
  projectId: number | null,
  permitNumber: string,
) {
  for (const [variant, file] of byVariant) {
    const url = await saveUpload(file, projectId, permitNumber, variant);
    await db
      .insert(permitFiles)
      .values({ permitId, variant, fileName: file.name, url })
      .onConflictDoUpdate({
        target: [permitFiles.permitId, permitFiles.variant],
        set: { url, fileName: file.name },
      });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "issuePermit")) return jsonError(403, "Forbidden");

  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? "").trim();

  // The one add form covers both kinds. A company-content code covers no single
  // project, so it takes the emirate straight from the form and skips every
  // project step below. The switch is explicit rather than inferred from
  // whether a project was named: developer-level permits genuinely have no DLD
  // number, and guessing would flip those to 'general' and quietly send their
  // videos to a manager instead of the team lead.
  const isCompany = form.get("companyContent") === "true";

  if (isCompany) {
    const qr = qrFilesFrom(form);
    if (typeof qr === "string") return jsonError(422, qr);

    const emirate = str("emirate");
    if (!isEmirate(emirate)) return jsonError(422, "Choose the emirate.");

    const label = str("covers");
    if (label.length < 2) return jsonError(422, "Say what this permit covers.");

    // Digits only, as permits_general_shape requires — a company code is
    // matched against the free text creators type on a deliverable, and the
    // comparison is digits on both sides.
    const code = digitsOnly(str("permitNumber"));
    if (!code) return jsonError(422, "A permit code must contain at least one digit");

    const [clash] = await db
      .select({ id: permits.id, isActive: permits.isActive })
      .from(permits)
      .where(and(eq(permits.category, "general"), eq(permits.permitNumber, code)))
      .limit(1);
    if (clash) {
      return jsonError(
        409,
        clash.isActive
          ? `${code} is already a company permit.`
          : `${code} is on the list but switched off — turn it back on instead.`,
      );
    }

    const expiresOn = str("listingEnd");
    if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
      return jsonError(422, "Enter a valid expiry date.");
    }

    const [created] = await db
      .insert(permits)
      .values({
        category: "general",
        permitNumber: code,
        emirate,
        label,
        // Informational for a company code: routing follows the Active switch,
        // so a date passing never reassigns review work on its own.
        listingEnd: expiresOn || null,
        notes: str("notes") || null,
        issuedByEmail: session.user.email,
      })
      .returning({ id: permits.id });

    try {
      await saveQrFiles(qr, created.id, null, code);
    } catch (e) {
      // The permit IS recorded, so a plain failure would have the admin add it
      // a second time. Same reasoning as the offplan branch below.
      console.error("[issue] upload failed", e);
      return NextResponse.json(
        {
          error: `Permit saved, but a file failed to upload: ${
            e instanceof Error ? e.message : String(e)
          }`,
          permitId: created.id,
        },
        { status: 200 },
      );
    }

    await logAudit({
      entity: "permit",
      entityId: String(created.id),
      action: "create_general",
      actorId: session.user.id,
      diff: { code, label, emirate, expiresOn: expiresOn || null },
    });

    return NextResponse.json({ id: created.id, code }, { status: 201 });
  }

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

  // The permit inherits the emirate of the project it covers — that is what
  // decides whether this is a Trakheesi or a Madhmoun permit. Read back rather
  // than taken from the form, so an existing project cannot be issued a permit
  // for an emirate it is not in.
  const [project] = await db
    .select({ emirate: projects.emirate })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return jsonError(422, "Unknown project.");
  if (!isEmirate(project.emirate)) {
    return jsonError(
      422,
      "This project has no emirate set, so there is no way to tell which authority issues its permit. Set it on the project first.",
    );
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
    listingEnd: str("listingEnd"),
  });
  if (!parsed.ok) return jsonError(422, parsed.error);
  const { permitNumber, listingStart, listingEnd } = parsed.value;

  const byVariant = qrFilesFrom(form);
  if (typeof byVariant === "string") return jsonError(422, byVariant);

  // A new row rather than an update, so a renewal leaves last year's permit
  // intact and the history of what was valid when survives.
  const [permit] = await db
    .insert(permits)
    .values({
      projectId,
      emirate: project.emirate,
      permitNumber,
      listingStart,
      listingEnd,
      notes: str("notes") || null,
      issuedByEmail: session.user.email,
    })
    .returning();

  try {
    await saveQrFiles(byVariant, permit.id, projectId, permitNumber);
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
