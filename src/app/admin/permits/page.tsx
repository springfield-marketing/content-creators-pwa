import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PermitsTable } from "@/components/registry/PermitsTable";
import { can } from "@/lib/registry/access";
import { getAllPermits, getProjects } from "@/lib/registry/queries";
import { forRoles } from "@/lib/registry/visibility";

// The permits tab in the dashboard: every permit, both kinds, with the actions
// to view, edit, renew and add.
//
// Redaction still runs, even though everyone who reaches this page can see
// everything today. It is one line, and the alternative is that the day a role
// arrives without viewPermitDetails, this page quietly hands it the lot.
export const dynamic = "force-dynamic";

export default async function AdminPermitsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  // Agents have their own read-only view at /permits, reached from the booking
  // flow; this is the tab for the people who maintain permits.
  if (!can(roles, "viewPermitDetails")) redirect("/permits");

  const [allPermits, projectRows] = await Promise.all([
    getAllPermits(),
    getProjects(),
  ]);
  const permits = forRoles(allPermits, roles);
  // Names only — all the add dialog needs to attach a permit to an existing
  // project rather than create a second one for it.
  const projects = projectRows.map((p) => ({ id: p.id, name: p.name }));

  return (
    <PermitsTable
      permits={permits}
      projects={projects}
      showDetails
      showQr={can(roles, "viewQr")}
      mayIssue={can(roles, "issuePermit")}
      mayManageGeneral={can(roles, "issuePermit")}
    />
  );
}
