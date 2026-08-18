"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Alert,
  Anchor,
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
} from "@mantine/core";
import dayjs from "dayjs";
import { UserMenu } from "@/components/UserMenu";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarTime,
  IconCalendarWeek,
  IconChartBar,
  IconChecklist,
  IconGavel,
  IconHistory,
  IconLicense,
  IconSettings,
  IconTargetArrow,
  IconUserShield,
  IconUsers,
} from "@tabler/icons-react";

// Manager shell: desktop-first sidebar, grouped by function, collapsible on
// mobile. A team_lead only reaches the review queue, so they see just that.
const NAV_GROUPS = [
  {
    title: "Review",
    links: [
      { href: "/admin/review", label: "Queue", icon: IconChecklist },
      { href: "/admin/review-log", label: "Review log", icon: IconGavel },
      { href: "/admin/permits", label: "General permits", icon: IconLicense },
    ],
  },
  {
    title: "Schedule",
    links: [
      { href: "/admin/schedule", label: "Weekly plan", icon: IconCalendarTime },
      { href: "/admin/bookings", label: "Bookings", icon: IconCalendarWeek },
    ],
  },
  {
    title: "Insights",
    links: [
      { href: "/admin/activity", label: "Activity", icon: IconHistory },
      { href: "/admin/kpis", label: "KPIs", icon: IconChartBar },
      { href: "/admin/targets", label: "Targets", icon: IconTargetArrow },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/admin/creators", label: "Creators", icon: IconSettings },
      { href: "/admin/agents", label: "Agents", icon: IconUsers },
      { href: "/admin/team", label: "Team", icon: IconUserShield },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  const { data: session } = useSession();
  // A team_lead only reaches the review queue (see proxy.ts) — offering the
  // rest of the sidebar would just bounce them back out.
  const isManager = !!session?.user?.roles?.includes("manager");

  // A permit lapsing is worth interrupting someone about — it only showed on
  // the permits screen, which nobody opens unless they already suspect a
  // problem. Managers only: a team lead can't reach that screen to act on it.
  const [lapsing, setLapsing] = useState<
    { id: string; code: string; label: string; expiresOn: string | null }[]
  >([]);
  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    fetch("/api/admin/permits")
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          rows: {
            id: string;
            code: string;
            label: string;
            isActive: boolean;
            expiresOn: string | null;
          }[]
        ) => {
          if (cancelled) return;
          const cutoff = dayjs().add(30, "day");
          setLapsing(
            rows.filter(
              (p) =>
                p.isActive &&
                p.expiresOn !== null &&
                dayjs(p.expiresOn).isBefore(cutoff)
            )
          );
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isManager]);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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
          <UserMenu showName={false} />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {NAV_GROUPS.map((group) => {
          const items = group.links.filter(
            (l) => isManager || l.href === "/admin/review"
          );
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              {isManager && (
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  px="sm"
                  pt="md"
                  pb={4}
                >
                  {group.title}
                </Text>
              )}
              {items.map((link) => (
                <NavLink
                  key={link.href}
                  component={Link}
                  href={link.href}
                  label={link.label}
                  fw={500}
                  leftSection={<link.icon size={20} stroke={1.5} />}
                  active={isActive(link.href)}
                  onClick={close}
                />
              ))}
            </div>
          );
        })}
      </AppShell.Navbar>

      <AppShell.Main>
        {lapsing.length > 0 && (
          <Alert
            color={
              lapsing.some((p) => dayjs(p.expiresOn).isBefore(dayjs()))
                ? "red"
                : "orange"
            }
            variant="light"
            icon={<IconLicense size={18} />}
            mb="md"
          >
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Text size="sm">
                {lapsing
                  .map(
                    (p) =>
                      `${p.label} (${p.code}) ${
                        dayjs(p.expiresOn).isBefore(dayjs())
                          ? `expired ${dayjs(p.expiresOn).format("D MMM")}`
                          : `expires ${dayjs(p.expiresOn).format("D MMM")}`
                      }`
                  )
                  .join(" · ")}
              </Text>
              <Anchor component={Link} href="/admin/permits" size="sm">
                Renew or switch off
              </Anchor>
            </Group>
          </Alert>
        )}
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
