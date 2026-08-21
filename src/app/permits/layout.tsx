"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Anchor,
  Box,
  Container,
  Group,
  Text,
} from "@mantine/core";
import { UserMenu } from "@/components/UserMenu";
import { can } from "@/lib/registry/access";
import type { Role } from "@/auth";

// Registry shell, for the people whose whole job here is permits: booking
// agents, marketing, and the permit admins. Creators reach the same data from
// inside their own mobile shell at /creator/permits, so they never see this.
export default function PermitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const roles = (session?.user?.roles ?? []) as Role[];

  const tabs = [
    { href: "/permits", label: "Projects", show: true },
    {
      href: "/permits/requests",
      label: can(roles, "viewAllRequests") ? "Requests" : "My requests",
      show: can(roles, "viewOwnRequests"),
    },
  ].filter((t) => t.show);

  return (
    <>
      <Box component="header" className="app-header" py="xs">
        <Container size="lg">
          <Group justify="space-between">
            <Group gap="lg">
              <Text fw={700}>Permits</Text>
              <Group gap="md">
                {tabs.map((tab) => {
                  const active =
                    tab.href === "/permits"
                      ? pathname === "/permits"
                      : pathname.startsWith(tab.href);
                  return (
                    <Anchor
                      key={tab.href}
                      component={Link}
                      href={tab.href}
                      size="sm"
                      fw={active ? 600 : 400}
                      c={active ? "brand" : "dimmed"}
                    >
                      {tab.label}
                    </Anchor>
                  );
                })}
              </Group>
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
