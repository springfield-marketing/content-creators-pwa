"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Anchor, Box, Container, Group } from "@mantine/core";

// Agent-facing shell, deliberately the same as the booking one: agents arrive
// here from /book to check whether a project can be marketed, and should not
// feel they have left. Admins maintain permits in the dashboard instead, at
// /admin/permits.
export default function AgentPermitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <Box component="header" className="app-header" py="sm">
        <Container size="sm">
          <Group justify="space-between">
            <Anchor component={Link} href="/book" underline="never">
              <Image
                src="/Springfield Properties Logo.png"
                alt="Springfield Properties"
                width={128}
                height={30}
                className="brand-logo"
                priority
              />
            </Anchor>
            <Group gap="md">
              <Anchor
                component={Link}
                href="/permits"
                size="sm"
                c={pathname === "/permits" ? "brand" : "dimmed"}
                fw={pathname === "/permits" ? 600 : 400}
              >
                Permits
              </Anchor>
              <Anchor
                component={Link}
                href="/permits/requests"
                size="sm"
                c={pathname.startsWith("/permits/requests") ? "brand" : "dimmed"}
                fw={pathname.startsWith("/permits/requests") ? 600 : 400}
              >
                My requests
              </Anchor>
              <Anchor component={Link} href="/book" size="sm" c="dimmed">
                Book
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>
      <Container size="sm" py="lg">
        {children}
      </Container>
    </>
  );
}
