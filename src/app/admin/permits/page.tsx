import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PermitsTable } from "@/components/registry/PermitsTable";
import { can, canReachRegistry } from "@/lib/registry/access";
import { getAllPermits } from "@/lib/registry/queries";
import { forRoles } from "@/lib/registry/visibility";

// Every permit, both kinds, in one list. The whole set ships to the browser so
// search needs no round trip — which is why what someone may not see is removed
// here, on the server, rather than merely left undrawn.
export const dynamic = "force-dynamic";

export default async function PermitsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  const isManager = roles.includes("manager");
  // Agents have their own read-only view at /permits, reached from the booking
  // flow; this is the dashboard tab for the people who maintain permits.
  if (!isManager && !can(roles, "viewPermitDetails")) redirect("/permits");

  const all = await getAllPermits();

  // The two kinds are gated on different things, so they are assembled
  // separately rather than run through one redaction.
  //
  // Offplan is the registry: who sees permit numbers and QR codes comes from
  // the capability table, and forRoles strips what an agent may not have.
  //
  // General codes belong to managers — they decide who reviews what. Never
  // redacted, because a manager who cannot read the code cannot manage it; and
  // never shown to anyone else, because it is not their business. Running these
  // through forRoles blanked the very codes the screen exists to edit.
  const offplan = canReachRegistry(roles)
    ? forRoles(
        all.filter((p) => p.category === "offplan"),
        roles,
      )
    : [];
  const general = isManager ? all.filter((p) => p.category === "general") : [];

  const permits = [...offplan, ...general].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <PermitsTable
      permits={permits}
      // A manager sees only general codes, which are never redacted, so the
      // detail columns are safe to draw for them even though the capability
      // table grants them nothing in the registry.
      showDetails={can(roles, "viewPermitDetails") || isManager}
      showQr={can(roles, "viewQr")}
      mayIssue={can(roles, "issuePermit")}
      mayManageGeneral={isManager}
    />
  );
}
