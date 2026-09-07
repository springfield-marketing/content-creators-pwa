import { redirect } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { auth } from "@/auth";
import { PermitLookup } from "@/components/registry/PermitLookup";
import { canReachRegistry } from "@/lib/registry/access";
import { getAllPermits } from "@/lib/registry/queries";

// What an agent checks before booking a shoot: can this project be marketed?
//
// The same lookup whoever is asking. It used to bounce anyone holding
// viewPermitDetails to /admin/permits on the grounds that the dashboard does
// more — but reaching this from the booking header is a different question from
// maintaining the registry, and the redirect meant the people who maintain
// permits could never see what an agent sees.
//
// Offplan only. General codes decide who reviews a deliverable and are no
// business of anyone standing in the booking flow.
export const dynamic = "force-dynamic";

export default async function AgentPermitsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canReachRegistry(session.user.roles)) redirect("/");

  // Projected here rather than redacted downstream. forRoles blanks fields a
  // role may not see, which would still have shipped a manager the numbers and
  // expiry dates this page has no business showing anyone — building the rows
  // from name and developer alone means there is nothing to withhold.
  //
  // Expiring counts as available: a permit inside its last 30 days is still
  // valid today, and a countdown is the registry's concern, not an agent's.
  const projects = (await getAllPermits())
    .filter(
      (p) =>
        p.category === "offplan" &&
        (p.status === "active" || p.status === "expiring"),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      developer: p.developer,
      emirate: p.emirate,
    }));

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>Permits</Title>
        <Text size="sm" c="dimmed">
          Projects you can market right now. Anything not listed has no permit
          in force — ask marketing before advertising it.
        </Text>
      </div>

      <PermitLookup projects={projects} />
    </Stack>
  );
}
