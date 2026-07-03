"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Signed-in user chip with sign-out, shown in the creator/admin headers.
export function UserMenu({ showName = true }: { showName?: boolean }) {
  const { data: session } = useSession();
  const name = session?.user?.name ?? "";

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
