"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AppShell, Burger, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarTime,
  IconCalendarWeek,
  IconChartBar,
  IconChecklist,
  IconFileText,
  IconGavel,
  IconHistory,
  IconInbox,
  IconLicense,
  IconRefresh,
  IconSettings,
  IconTargetArrow,
  IconUserShield,
  IconUsers,
} from "@tabler/icons-react";
import { UserMenu } from "@/components/UserMenu";
import { activeNavHref } from "@/lib/nav";

// Icons are named rather than passed as components: a server layout builds the
// sidebar (so it renders before the browser knows who you are), and a function
// cannot cross into a client component. A string can.
const ICONS = {
  bookings: IconCalendarWeek,
  chart: IconChartBar,
  creators: IconSettings,
  history: IconHistory,
  permits: IconLicense,
  queue: IconChecklist,
  renewals: IconRefresh,
  requests: IconInbox,
  reviewLog: IconGavel,
  schedule: IconCalendarTime,
  targets: IconTargetArrow,
  team: IconUserShield,
  users: IconUsers,
  list: IconFileText,
} as const;

export type ChromeIcon = keyof typeof ICONS;

export type ChromeLink = {
  href: string;
  label: string;
  icon: ChromeIcon;
};

export type ChromeGroup = {
  /** Omitted when there is only one group and a heading would be noise. */
  title?: string;
  links: ChromeLink[];
};

/**
 * The app's shell: desktop-first sidebar, collapsible on mobile.
 *
 * Extracted from the admin layout so every signed-in area looks the same.
 * Permits used to ship its own header and horizontal tab strip, carried over
 * from the standalone registry — two apps in one binary. Callers decide what
 * goes in the sidebar; the chrome itself is not theirs to vary.
 */
export function AppChrome({
  title,
  groups,
  banner,
  children,
}: {
  title: string;
  groups: ChromeGroup[];
  /** Rendered above the page, for things worth interrupting someone about. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();

  // Only the most specific match, so a parent entry does not stay lit while
  // you are on a child screen beneath it.
  const active = activeNavHref(
    pathname,
    groups.flatMap((g) => g.links.map((l) => l.href)),
  );

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Image
              src="/S LOGO-Blue.png"
              alt="Springfield Properties"
              width={26}
              height={26}
            />
            <Text fw={700}>{title}</Text>
          </Group>
          <UserMenu showName={false} />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {groups.map((group, i) => (
          <div key={group.title ?? i}>
            {group.title && (
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
            {group.links.map((link) => (
              <NavLink
                key={link.href}
                component={Link}
                href={link.href}
                label={link.label}
                fw={500}
                leftSection={(() => {
                  const Icon = ICONS[link.icon];
                  return <Icon size={20} stroke={1.5} />;
                })()}
                active={link.href === active}
                onClick={close}
              />
            ))}
          </div>
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        {banner}
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
