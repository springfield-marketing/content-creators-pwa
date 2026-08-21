"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Anchor, Group } from "@mantine/core";

export type PermitTab = { href: string; label: string };

/**
 * The section tabs. Client-side only for `usePathname`, which decides the
 * active one — which tabs exist at all is settled on the server, because
 * deriving them from `useSession()` rendered an empty nav until the browser
 * had fetched the session.
 */
export function PermitsNav({ tabs }: { tabs: PermitTab[] }) {
  const pathname = usePathname();

  return (
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
  );
}
