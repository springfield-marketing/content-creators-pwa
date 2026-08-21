import { redirect } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { auth } from "@/auth";
import { RequestsPanel } from "@/components/registry/RequestsPanel";
import { can } from "@/lib/registry/access";
import { getProjects } from "@/lib/registry/queries";

export const dynamic = "force-dynamic";

export default async function PermitRequestsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;
  if (!can(roles, "viewOwnRequests")) redirect("/admin/permits");

  const seesAll = can(roles, "viewAllRequests");
  // Names only — the autocomplete needs nothing else, and shipping the full
  // rows here would hand an agent the permit details the list redacts.
  const projects = (await getProjects()).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{seesAll ? "Requests" : "My requests"}</Title>
        <Text size="sm" c="dimmed">
          {seesAll
            ? "Every permit request raised, newest first"
            : "Permit requests you have raised"}
        </Text>
      </div>

      <RequestsPanel
        canRequest={can(roles, "requestPermit")}
        showRequester={seesAll}
        canResolve={can(roles, "issuePermit")}
        projects={projects}
      />
    </Stack>
  );
}
