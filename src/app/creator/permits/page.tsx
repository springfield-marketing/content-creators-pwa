import { redirect } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { auth } from "@/auth";
import { ProjectSearch } from "@/components/registry/ProjectSearch";
import { can } from "@/lib/registry/access";
import { getProjects } from "@/lib/registry/queries";
import { forRoles } from "@/lib/registry/visibility";

// The same registry, inside the creator's mobile shell.
//
// Creators log a permit number by hand on every video they submit, and until
// now had nowhere to look one up — this is the screen that closes that loop.
// They read; requesting and issuing belong to marketing and the permit admins.
export const dynamic = "force-dynamic";

export default async function CreatorPermitsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  const projects = forRoles(await getProjects(), roles);

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Permits</Title>
        <Text size="sm" c="dimmed">
          Look up the permit number and QR codes for what you&apos;re shooting.
        </Text>
      </div>

      <ProjectSearch
        projects={projects}
        showDetails={can(roles, "viewPermitDetails")}
        showQr={can(roles, "viewQr")}
      />
    </Stack>
  );
}
