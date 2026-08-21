import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { developers, permitFiles, permitRequests, permits, projects } from "@/db/schema";
import { type PermitStatus, permitStatus, todayInDubai } from "./permit-status";

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
    db
      .select({
        projectId: permits.projectId,
        permitId: permits.id,
        permitNumber: permits.permitNumber,
        listingEnd: permits.listingEnd,
        qrUrl: permits.qrUrl,
      })
      .from(permits)
      .orderBy(desc(permits.listingEnd)),
    db
      .select({ permitId: permitFiles.permitId, variant: permitFiles.variant })
      .from(permitFiles),
  ]);

  const filesPerPermit = new Map<number, number>();
  for (const f of fileRows)
    filesPerPermit.set(f.permitId, (filesPerPermit.get(f.permitId) ?? 0) + 1);

  // Permits arrive newest-first, so the first one seen per project is current.
  const current = new Map<number, (typeof permitRows)[number]>();
  const counts = new Map<number, number>();
  for (const p of permitRows) {
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
