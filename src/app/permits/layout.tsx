import { redirect } from "next/navigation";
import { Box, Container, Group, Text } from "@mantine/core";
import { auth } from "@/auth";
import { UserMenu } from "@/components/UserMenu";
import { PermitsNav, type PermitTab } from "@/components/registry/PermitsNav";
import { can, canReachRegistry } from "@/lib/registry/access";

// The permits section. Two different things share it: "Offplan" is the
// Trakheesi registry — per-project DLD permits deciding whether a project may
// be marketed — and "General" is the company-content codes deciding who reviews
// a deliverable. One place to look for a permit; still two separate tables.
//
// A server component so the tabs are decided before the HTML is sent. Reading
// roles from useSession() here rendered an empty nav on first paint, because
// the session is not known until the browser fetches it.
//
// Creators reach offplan permits from inside their own mobile shell at
// /creator/permits and never see this.
export default async function PermitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles;

  const tabs: PermitTab[] = [
    { href: "/permits", label: "Offplan", show: canReachRegistry(roles) },
    {
      href: "/permits/requests",
      label: can(roles, "viewAllRequests") ? "Requests" : "My requests",
      show: can(roles, "viewOwnRequests"),
    },
    {
      href: "/permits/renew",
      label: "Renewals",
      show: can(roles, "batchRenew"),
    },
    {
      href: "/permits/general",
      label: "General",
      show: roles.includes("manager"),
    },
  ]
    .filter((t) => t.show)
    .map(({ href, label }) => ({ href, label }));

  return (
    <>
      <Box component="header" className="app-header" py="xs">
        <Container size="lg">
          <Group justify="space-between">
            <Group gap="lg">
              <Text fw={700}>Permits</Text>
              <PermitsNav tabs={tabs} />
            </Group>
            <UserMenu />
          </Group>
        </Container>
      </Box>

      <Container size="lg" py="md">
        {children}
      </Container>
    </>
  );
}
