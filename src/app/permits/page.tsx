import { redirect } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { auth } from "@/auth";
import { PermitsTable } from "@/components/registry/PermitsTable";
import { can, canReachRegistry } from "@/lib/registry/access";
import { getAllPermits } from "@/lib/registry/queries";
import { forRoles } from "@/lib/registry/visibility";

// What an agent checks before booking a shoot: can this project be marketed?
//
// Read-only and offplan-only. General codes decide who reviews a deliverable
// and are no business of an agent's; maintaining permits happens in the
// dashboard at /admin/permits.
export const dynamic = "force-dynamic";

export default async function AgentPermitsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  if (!canReachRegistry(roles)) redirect("/");
  // Anyone who maintains permits belongs on the dashboard screen, which can do
  // everything this one can and more.
  if (can(roles, "viewPermitDetails")) redirect("/admin/permits");

  const all = await getAllPermits();
  const permits = forRoles(
    all.filter((p) => p.category === "offplan"),
    roles,
  );

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Permits</Title>
        <Text size="sm" c="dimmed">
          Projects you can market right now. Ask marketing before advertising
          anything that isn&apos;t listed.
        </Text>
      </div>

      <PermitsTable permits={permits} showDetails={false} showQr={false} />
    </Stack>
  );
}
