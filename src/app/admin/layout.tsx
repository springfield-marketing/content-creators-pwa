"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  AppShell,
  Avatar,
  Burger,
  Group,
  NavLink,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarWeek,
  IconChartBar,
  IconChecklist,
  IconSettings,
  IconTargetArrow,
  IconUsers,
} from "@tabler/icons-react";

// Manager shell: desktop-first sidebar, collapsible on mobile.
const links = [
  { href: "/admin/review", label: "Review queue", icon: IconChecklist },
  { href: "/admin/kpis", label: "KPI dashboard", icon: IconChartBar },
  { href: "/admin/targets", label: "Targets", icon: IconTargetArrow },
  { href: "/admin/agents", label: "Agents", icon: IconUsers },
  { href: "/admin/bookings", label: "Bookings", icon: IconCalendarWeek },
  { href: "/admin/creators", label: "Creators", icon: IconSettings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Image
              src="/S LOGO-Blue.png"
              alt="Springfield Properties"
              width={26}
              height={26}
            />
            <Text fw={700}>Content Team · Admin</Text>
          </Group>
          <Avatar color="brand" radius="xl" size="sm">
            M
          </Avatar>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {links.map((link) => (
          <NavLink
            key={link.href}
            component={Link}
            href={link.href}
            label={link.label}
            fw={500}
            leftSection={<link.icon size={20} stroke={1.5} />}
            active={pathname.startsWith(link.href)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
