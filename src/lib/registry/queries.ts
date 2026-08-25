import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  developers,
  permitFiles,
  permitRequests,
  permits,
  projects,
  type PermitCategory,
} from "@/db/schema";
import { type PermitStatus, permitStatus, todayInDubai } from "./permit-status";
import { type Authority, authorityFor } from "./authority";

export type ProjectRow = {
  id: number;
  dldProjectNumber: string | null;
  name: string;
  developer: string | null;
  emirate: string | null;
  permitNumber: string | null;
  listingEnd: string | null;
  qrUrl: string | null;
  status: PermitStatus;
  /** Extra permits beyond the current one, e.g. a one-day event permit. */
  otherPermits: number;
  /** How many QR variants the current permit has. The files themselves are
   *  fetched when the dialog opens rather than shipped with the list. */
  fileCount: number;
};

/**
 * Every project with its current permit — the one running latest.
 *
 * At ~400 projects the whole set goes to the client in one payload and is
 * filtered there, so search needs no round trip. Revisit if this reaches
 * thousands.
 */
export async function getProjects(): Promise<ProjectRow[]> {
  const today = todayInDubai();

  const [projectRows, permitRows, fileRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        dldProjectNumber: projects.dldProjectNumber,
        name: projects.nameEn,
        developer: developers.nameEn,
        emirate: projects.emirate,
      })
      .from(projects)
      .leftJoin(developers, eq(projects.developerId, developers.id))
      .orderBy(projects.nameEn),
    // Offplan only. The same table holds general company-content codes, which
    // have no project and belong to a different screen entirely; without this
    // they would arrive with a null projectId and pollute the map below.
    db
      .select({
        projectId: permits.projectId,
        permitId: permits.id,
        permitNumber: permits.permitNumber,
        listingEnd: permits.listingEnd,
        qrUrl: permits.qrUrl,
      })
      .from(permits)
      .where(eq(permits.category, "offplan"))
      .orderBy(desc(permits.listingEnd)),
    db
      .select({ permitId: permitFiles.permitId, variant: permitFiles.variant })
      .from(permitFiles),
  ]);

  const filesPerPermit = new Map<number, number>();
  for (const f of fileRows)
    filesPerPermit.set(f.permitId, (filesPerPermit.get(f.permitId) ?? 0) + 1);

  // Permits arrive newest-first, so the first one seen per project is current.
  // projectId is nullable on the column, but the where above and the
  // permits_offplan_shape CHECK together mean it cannot be null here.
  const current = new Map<number, (typeof permitRows)[number]>();
  const counts = new Map<number, number>();
  for (const p of permitRows) {
    if (p.projectId === null) continue;
    if (!current.has(p.projectId)) current.set(p.projectId, p);
    counts.set(p.projectId, (counts.get(p.projectId) ?? 0) + 1);
  }

  return projectRows.map((p) => {
    const permit = current.get(p.id);
    return {
      ...p,
      permitNumber: permit?.permitNumber ?? null,
      listingEnd: permit?.listingEnd ?? null,
      qrUrl: permit?.qrUrl ?? null,
      status: permitStatus(permit?.listingEnd ?? null, today),
      fileCount: permit ? (filesPerPermit.get(permit.permitId) ?? 0) : 0,
      otherPermits: Math.max(0, (counts.get(p.id) ?? 0) - 1),
    };
  });
}

/** `onlyFor` limits the list to one requester's own submissions. */
export async function getRequests(onlyFor?: string) {
  const q = db
    .select({
      id: permitRequests.id,
      requestedByEmail: permitRequests.requestedByEmail,
      requestedProjectName: permitRequests.requestedProjectName,
      note: permitRequests.note,
      status: permitRequests.status,
      createdAt: permitRequests.createdAt,
      projectId: permitRequests.projectId,
      projectName: projects.nameEn,
      dldProjectNumber: projects.dldProjectNumber,
    })
    .from(permitRequests)
    .leftJoin(projects, eq(permitRequests.projectId, projects.id))
    .$dynamic();
  return (onlyFor
    ? q.where(eq(permitRequests.requestedByEmail, onlyFor))
    : q
  ).orderBy(desc(permitRequests.createdAt));
}

export type QrFile = { variant: string; fileName: string; url: string };

// Stable, meaningful order rather than insertion order.
const VARIANT_ORDER = ["original", "facebook", "instagram", "twitter"];

/**
 * The QR images on a project's current permit.
 *
 * Fetched when the dialog opens rather than shipped with the 396-row list —
 * four urls per project would more than double the payload for something most
 * rows never need.
 *
 * Callers must check `viewQr` first; this does not, so that the check sits at
 * the route boundary where the session lives.
 */
export async function getQrFiles(projectId: number): Promise<QrFile[]> {
  const [current] = await db
    .select({ id: permits.id })
    .from(permits)
    .where(and(eq(permits.category, "offplan"), eq(permits.projectId, projectId)))
    .orderBy(desc(permits.listingEnd))
    .limit(1);
  if (!current) return [];

  const rows = await db
    .select({
      variant: permitFiles.variant,
      fileName: permitFiles.fileName,
      url: permitFiles.url,
    })
    .from(permitFiles)
    .where(eq(permitFiles.permitId, current.id));

  return rows.sort(
    (a, b) => VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant),
  );
}

export type PermitRow = {
  id: number;
  category: PermitCategory;
  transactionNumber: string | null;
  emirate: string;
  /** Derived from the emirate; null where that emirate issues no permits. */
  authority: Authority | null;
  // Nullable because redaction blanks it — a permit always has one, but an
  // agent never receives it. See visibility.ts.
  permitNumber: string | null;
  /** Project name for offplan, the permit's own label for general. */
  name: string;
  developer: string | null;
  dldProjectNumber: string | null;
  projectId: number | null;
  listingEnd: string | null;
  isActive: boolean;
  status: PermitStatus;
  qrUrl: string | null;
  fileCount: number;
};

/**
 * Every permit, both kinds, for the one list the app shows.
 *
 * Offplan rows collapse to the current permit per project — a renewal is a new
 * row, and the list is about what is valid now, not the history. General codes
 * have no project so each is its own row.
 */
export async function getAllPermits(): Promise<PermitRow[]> {
  const today = todayInDubai();

  const [rows, fileRows] = await Promise.all([
    db
      .select({
        id: permits.id,
        category: permits.category,
        emirate: permits.emirate,
        permitNumber: permits.permitNumber,
        transactionNumber: permits.transactionNumber,
        label: permits.label,
        isActive: permits.isActive,
        listingEnd: permits.listingEnd,
        qrUrl: permits.qrUrl,
        projectId: permits.projectId,
        projectName: projects.nameEn,
        dldProjectNumber: projects.dldProjectNumber,
        developer: developers.nameEn,
      })
      .from(permits)
      .leftJoin(projects, eq(permits.projectId, projects.id))
      .leftJoin(developers, eq(projects.developerId, developers.id))
      .orderBy(desc(permits.listingEnd)),
    db
      .select({ permitId: permitFiles.permitId, variant: permitFiles.variant })
      .from(permitFiles),
  ]);

  const filesPerPermit = new Map<number, number>();
  for (const f of fileRows)
    filesPerPermit.set(f.permitId, (filesPerPermit.get(f.permitId) ?? 0) + 1);

  // Newest-first, so the first row seen for a project is its current permit.
  const seenProject = new Set<number>();
  const out: PermitRow[] = [];

  for (const r of rows) {
    if (r.category === "offplan") {
      if (r.projectId === null || seenProject.has(r.projectId)) continue;
      seenProject.add(r.projectId);
    }
    out.push({
      id: r.id,
      category: r.category,
      emirate: r.emirate,
      transactionNumber: r.transactionNumber,
      authority: authorityFor(r.emirate),
      permitNumber: r.permitNumber,
      name: (r.category === "general" ? r.label : r.projectName) ?? "—",
      developer: r.developer,
      dldProjectNumber: r.dldProjectNumber,
      projectId: r.projectId,
      listingEnd: r.listingEnd,
      isActive: r.isActive,
      // A general code is governed by its switch, not its dates: an expired one
      // keeps routing work to managers until someone turns it off.
      status:
        r.category === "general"
          ? r.isActive
            ? "active"
            : "expired"
          : permitStatus(r.listingEnd, today),
      qrUrl: r.qrUrl,
      fileCount: filesPerPermit.get(r.id) ?? 0,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export type LapsingPermit = {
  id: number;
  name: string;
  category: PermitCategory;
  permitNumber: string;
  listingEnd: string;
  /** Negative once it has lapsed. */
  daysLeft: number;
};

/**
 * Permits at or past the end of their listing window, soonest first.
 *
 * Only the permit currently running for each project. A renewal is a new row
 * and the one it replaces is kept as history — counting those would report
 * every project ever renewed as expired, permanently.
 *
 * General codes appear only if they carry an expiry date. Their status is
 * governed by the `is_active` switch rather than the calendar, so one without
 * a date is not lapsing, it is simply on.
 */
export async function getLapsingPermits(
  withinDays = 60,
): Promise<LapsingPermit[]> {
  const today = todayInDubai();

  const { rows } = await db.execute(sql`
    SELECT p.id,
           p.category,
           p.permit_number,
           p.listing_end,
           COALESCE(pr.name_en, p.label, '—') AS name,
           (p.listing_end - ${today}::date) AS days_left
    FROM (
      SELECT DISTINCT ON (COALESCE(project_id, -id)) *
      FROM permits
      WHERE is_active AND listing_end IS NOT NULL
      -- Negated id keeps every general code in a group of its own, since they
      -- share a NULL project.
      ORDER BY COALESCE(project_id, -id), listing_end DESC
    ) p
    LEFT JOIN projects pr ON pr.id = p.project_id
    WHERE p.listing_end <= ${today}::date + ${withinDays}::int
    ORDER BY p.listing_end, name
  `);

  return (rows as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    category: r.category as PermitCategory,
    permitNumber: String(r.permit_number),
    listingEnd: String(r.listing_end),
    daysLeft: Number(r.days_left),
  }));
}
