"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Anchor, Group, Text } from "@mantine/core";
import dayjs from "dayjs";
import { IconLicense } from "@tabler/icons-react";

type Lapsing = {
  id: number;
  code: string;
  label: string;
  expiresOn: string | null;
};

/**
 * A permit lapsing is worth interrupting someone about — it only showed on the
 * permits screen, which nobody opens unless they already suspect a problem.
 *
 * Split out of the admin layout so that layout could become a server component
 * and render its sidebar before the browser knows who you are. This part still
 * has to be client-side: it fetches.
 */
export function LapsingPermitsBanner() {
  const [lapsing, setLapsing] = useState<Lapsing[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/permits")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: (Lapsing & { isActive: boolean })[]) => {
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (lapsing.length === 0) return null;

  return (
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
        <Anchor component={Link} href="/admin/permits" size="sm">
          Renew or switch off
        </Anchor>
      </Group>
    </Alert>
  );
}
