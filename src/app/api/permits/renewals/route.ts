// Batch renewals.
//
// GET   — the template, every project, soonest-expiring first
// POST  — preview an uploaded file (writes nothing) or apply a previewed batch
//
// 396 of the 402 permits share one expiry date, so renewing them one at a time
// was never going to happen. Preview and apply are deliberately separate: an
// admin sees exactly what a file would do before anything is written.

import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { auth } from "@/auth";
import { db } from "@/db";
import { permits, projects } from "@/db/schema";
import { jsonError } from "@/lib/api";
import { can } from "@/lib/registry/access";
import { validateIssue } from "@/lib/registry/issue";
import { getProjects } from "@/lib/registry/queries";
import { RENEWAL_HEADERS, type RenewalRow, parseRenewals } from "@/lib/registry/renewal";

export const dynamic = "force-dynamic";

const cell = (v: string | null) => `"${(v ?? "").replaceAll('"', '""')}"`;

export async function GET() {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "batchRenew")) return jsonError(403, "Forbidden");

  const rows = await getProjects();
  const lines = [
    RENEWAL_HEADERS.join(","),
    // Every project ships, sorted soonest-expiring first so the ones that
    // matter are at the top of the spreadsheet. Blank rows are skipped on
    // upload, so there is no need to delete the ones not being renewed.
    ...rows
      .slice()
      .sort((a, b) =>
        (a.listingEnd ?? "9999").localeCompare(b.listingEnd ?? "9999"),
      )
      .map((p) =>
        [
          p.id,
          cell(p.dldProjectNumber),
          cell(p.name),
          cell(p.permitNumber),
          "",
          "",
          "",
        ].join(","),
      ),
  ];

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="permit-renewals.csv"',
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "batchRenew")) return jsonError(403, "Forbidden");

  const contentType = req.headers.get("content-type") ?? "";

  // Multipart = a file to preview. JSON = a previewed batch to apply.
  if (contentType.includes("multipart/form-data")) {
    return preview(req);
  }
  return apply(req, session.user.email!);
}

async function preview(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(422, "Choose a file.");
  }

  const records = parse(await file.text(), {
    relax_column_count: true,
    skip_empty_lines: true,
  }) as string[][];

  const parsed = parseRenewals(records);
  if (parsed.errors.length) {
    return NextResponse.json(
      { ok: false, rows: [], errors: parsed.errors, skipped: parsed.skipped },
      { status: 422 },
    );
  }

  const names = new Map(
    (
      await db.select({ id: projects.id, name: projects.nameEn }).from(projects)
    ).map((p) => [p.id, p.name]),
  );

  const unknown = parsed.rows.filter((r) => !names.has(r.projectId));
  if (unknown.length) {
    return NextResponse.json(
      {
        ok: false,
        rows: [],
        errors: unknown.map((r) => ({
          line: 0,
          message: `No project with id ${r.projectId}.`,
        })),
        skipped: parsed.skipped,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    rows: parsed.rows.map((r) => ({ ...r, name: names.get(r.projectId)! })),
    errors: [],
    skipped: parsed.skipped,
  });
}

/**
 * Re-validated here rather than trusting the client, and inserted in one
 * transaction so 396 renewals cannot half-land.
 */
async function apply(req: Request, email: string) {
  let rows: RenewalRow[];
  try {
    rows = (await req.json()).rows;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonError(422, "Nothing to apply.");
  }

  const ids = new Set<number>();
  for (const r of rows) {
    const checked = validateIssue(r);
    if (!checked.ok) return jsonError(422, checked.error);
    if (!Number.isInteger(r.projectId) || r.projectId <= 0) {
      return jsonError(422, "A row names an invalid project.");
    }
    // The parser rejects duplicates in a file; a hand-rolled POST could still
    // send them, and two permits issued to one project on one day is a mess to
    // unpick by hand.
    if (ids.has(r.projectId)) {
      return jsonError(422, `Project ${r.projectId} appears twice.`);
    }
    ids.add(r.projectId);
  }

  const known = await db
    .select({ id: projects.id })
    .from(projects);
  const knownIds = new Set(known.map((p) => p.id));
  for (const id of ids) {
    if (!knownIds.has(id)) return jsonError(422, `No project with id ${id}.`);
  }

  await db.insert(permits).values(
    rows.map((r) => ({
      projectId: r.projectId,
      permitNumber: r.permitNumber,
      listingStart: r.listingStart,
      listingEnd: r.listingEnd,
      issuedByEmail: email,
      notes: "batch renewal",
    })),
  );

  return NextResponse.json({ ok: true, applied: rows.length });
}
