"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Alert, Anchor, Group, Text } from "@mantine/core";
import dayjs from "dayjs";
import { AppChrome, type ChromeGroup } from "@/components/AppChrome";
import { IconLicense } from "@tabler/icons-react";

// Manager shell: desktop-first sidebar, grouped by function, collapsible on
// mobile. A team_lead only reaches the review queue, so they see just that.
const NAV_GROUPS: ChromeGroup[] = [
  {
    title: "Review",
    links: [
      { href: "/admin/review", label: "Queue", icon: "queue" },
      { href: "/admin/review-log", label: "Review log", icon: "reviewLog" },
    ],
  },
  {
    title: "Schedule",
    links: [
      { href: "/admin/schedule", label: "Weekly plan", icon: "schedule" },
      { href: "/admin/bookings", label: "Bookings", icon: "bookings" },
    ],
  },
  {
    title: "Insights",
    links: [
      { href: "/admin/activity", label: "Activity", icon: "history" },
      { href: "/admin/kpis", label: "KPIs", icon: "chart" },
      { href: "/admin/targets", label: "Targets", icon: "targets" },
    ],
  },
  {
    title: "Permits",
    links: [
      { href: "/permits", label: "All permits", icon: "permits" },
      { href: "/permits/requests", label: "Requests", icon: "requests" },
      { href: "/permits/renew", label: "Renewals", icon: "renewals" },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/admin/creators", label: "Creators", icon: "creators" },
      { href: "/admin/agents", label: "Agents", icon: "users" },
      { href: "/admin/team", label: "Team", icon: "team" },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          }[],
        ) => {
          if (cancelled) return;
          const cutoff = dayjs().add(30, "day");
          setLapsing(
            rows.filter(
              (p) =>
                p.isActive &&
                p.expiresOn !== null &&
                dayjs(p.expiresOn).isBefore(cutoff),
            ),
          );
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isManager]);
  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    // A team_lead only reaches the review queue (see route-access.ts) —
    // offering the rest of the sidebar would just bounce them back out.
    links: g.links.filter((l) => isManager || l.href === "/admin/review"),
  })).filter((g) => g.links.length > 0);

  return (
    <AppChrome
      title="Content Team · Admin"
      groups={groups}
      banner={
        lapsing.length > 0 && (
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
                      }`,
                  )
                  .join(" · ")}
              </Text>
              <Anchor component={Link} href="/permits" size="sm">
                Renew or switch off
              </Anchor>
            </Group>
          </Alert>
        )
      }
    >
      {children}
    </AppChrome>
  );
}
