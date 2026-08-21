import { redirect } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { auth } from "@/auth";
import { ProjectSearch } from "@/components/registry/ProjectSearch";
import { can, canReachRegistry } from "@/lib/registry/access";
import { getProjects } from "@/lib/registry/queries";
import { forRoles } from "@/lib/registry/visibility";

// The whole list ships to the browser so search needs no round trip, which is
// exactly why it is redacted here first — anything the client receives is
// readable by the user regardless of what the UI draws.
export const dynamic = "force-dynamic";

export default async function PermitsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  // Managers reach this section for the General tab and hold nothing in the
  // registry, so send them there rather than showing a fully redacted list.
  if (!canReachRegistry(roles)) redirect("/permits/general");

  const projects = forRoles(await getProjects(), roles);
  const showDetails = can(roles, "viewPermitDetails");

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Projects</Title>
        <Text size="sm" c="dimmed">
          {showDetails
            ? "Advertising permit status across every offplan project"
            : "Projects you can market right now"}
        </Text>
      </div>

      <ProjectSearch
        projects={projects}
        showDetails={showDetails}
        showQr={can(roles, "viewQr")}
        mayIssue={can(roles, "issuePermit")}
      />
    </Stack>
  );
}
