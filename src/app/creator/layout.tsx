"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Container,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { UserMenu } from "@/components/UserMenu";
import {
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconCirclePlus,
} from "@tabler/icons-react";

// Creator shell: phone-first app layout with a fixed bottom tab bar.
const tabs = [
  { href: "/creator", label: "Schedule", icon: IconCalendarEvent },
  { href: "/creator/log", label: "Log", icon: IconCirclePlus },
  { href: "/creator/progress", label: "Progress", icon: IconChartBar },
];

// A team leader shoots like everyone else and verifies on the side, so the
// review queue hangs off their own shell rather than sending them to /admin.
const REVIEW_TAB = {
  href: "/admin/review",
  label: "Review",
  icon: IconChecklist,
};

const TAB_BAR_HEIGHT = 64;

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const visibleTabs = session?.user?.roles?.includes("team_lead")
    ? [...tabs, REVIEW_TAB]
    : tabs;

  return (
    <>
      <Box component="header" className="app-header" py="xs">
        <Container size="sm">
          <Group justify="space-between">
            <Text fw={700}>My Content App</Text>
            <UserMenu />
          </Group>
        </Container>
      </Box>

      <Container size="sm" py="md" pb={TAB_BAR_HEIGHT + 24}>
        {children}
      </Container>

      <Box
        component="nav"
        pos="fixed"
        bottom={0}
        left={0}
        right={0}
        h={TAB_BAR_HEIGHT}
        bg="var(--mantine-color-body)"
        style={{
          borderTop: "1px solid var(--mantine-color-default-border)",
          zIndex: 100,
        }}
      >
        <Group grow h="100%" gap={0} maw={480} mx="auto">
          {visibleTabs.map((tab) => {
            const active =
              tab.href === "/creator"
                ? pathname === "/creator"
                : pathname.startsWith(tab.href);
            return (
              <UnstyledButton
                key={tab.href}
                component={Link}
                href={tab.href}
                h="100%"
              >
                <Stack
                  gap={2}
                  align="center"
                  justify="center"
                  h="100%"
                  c={active ? "brand" : "dimmed"}
                >
                  <tab.icon size={24} stroke={active ? 2 : 1.5} />
                  <Text size="xs" fw={active ? 600 : 400}>
                    {tab.label}
                  </Text>
                </Stack>
              </UnstyledButton>
            );
          })}
        </Group>
      </Box>
    </>
  );
}
