"use client";

import Link from "next/link";
import {
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconChevronRight,
  IconClipboardCheck,
  IconReportAnalytics,
  IconVideo,
} from "@tabler/icons-react";

// Temporary role switcher for the wireframe stage — replaced by real
// entry points (public /book link, Google login) when auth lands.
const roles = [
  {
    href: "/book",
    icon: IconCalendarEvent,
    title: "Agent",
    badge: "no login",
    description: "Book a shoot with a content creator.",
  },
  {
    href: "/creator",
    icon: IconVideo,
    title: "Creator",
    badge: "Google login",
    description: "See your schedule, log deliverables, track progress.",
  },
  {
    href: "/admin/review",
    icon: IconClipboardCheck,
    title: "Manager",
    badge: "admin",
    description: "Review deliverables, KPIs, targets, agents, bookings.",
  },
  {
    href: "/reports",
    icon: IconReportAnalytics,
    title: "Management",
    badge: "view-only",
    description: "Executive summary of team KPIs and trends.",
  },
];

export default function Home() {
  return (
    <Container size="md" py={64}>
      <Stack gap="xl">
        <Stack gap="xs" align="center" ta="center">
          <Badge variant="light" size="lg">
            Wireframe preview
          </Badge>
          <Title order={1} fz={{ base: 32, sm: 40 }}>
            Content Team Booking
          </Title>
          <Text c="dimmed" maw={480}>
            One app for booking shoots, logging deliverables, and tracking
            KPIs. Pick a role to browse its screens.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          {roles.map((role) => (
            <Card
              key={role.href}
              component={Link}
              href={role.href}
              className="hover-card"
            >
              <Group justify="space-between" align="flex-start">
                <ThemeIcon size={44} variant="light" radius="md">
                  <role.icon size={26} stroke={1.7} />
                </ThemeIcon>
                <Badge variant="default" size="sm" c="dimmed">
                  {role.badge}
                </Badge>
              </Group>
              <Group justify="space-between" mt="md" mb={4}>
                <Title order={3} fz="lg">
                  {role.title}
                </Title>
                <IconChevronRight
                  size={18}
                  color="var(--mantine-color-dimmed)"
                />
              </Group>
              <Text size="sm" c="dimmed">
                {role.description}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
