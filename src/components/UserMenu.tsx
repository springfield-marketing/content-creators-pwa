"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Avatar, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconCalendarEvent, IconChecklist, IconLogout } from "@tabler/icons-react";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Signed-in user chip with sign-out, shown in the creator/admin headers.
//
// Someone who both creates and verifies (a team leader) lives in two shells,
// and the admin sidebar is filtered down to the review queue for them — so the
// way back has to live here, in the one control both shells share.
export function UserMenu({ showName = true }: { showName?: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const name = session?.user?.name ?? "";

  const roles = session?.user?.roles ?? [];
  const wearsBothHats =
    roles.includes("creator") &&
    (roles.includes("team_lead") || roles.includes("manager"));
  const inAdmin = pathname.startsWith("/admin");
  const otherView = inAdmin
    ? { href: "/creator", label: "My schedule", icon: IconCalendarEvent }
    : { href: "/admin/review", label: "Review queue", icon: IconChecklist };

  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Group gap="xs">
            {showName && name && (
              <Text size="sm" c="dimmed" visibleFrom="xs">
                {name}
              </Text>
            )}
            <Avatar color="brand" radius="xl" size="sm">
              {name ? initials(name) : "…"}
            </Avatar>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {wearsBothHats && (
          <>
            <Menu.Label>Switch to</Menu.Label>
            <Menu.Item
              component={Link}
              href={otherView.href}
              leftSection={<otherView.icon size={14} />}
            >
              {otherView.label}
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Item
          leftSection={<IconLogout size={14} />}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
