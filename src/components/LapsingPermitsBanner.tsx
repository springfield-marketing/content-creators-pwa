"use client";

import Link from "next/link";
import { Alert, Anchor, Group, Text } from "@mantine/core";
import dayjs from "dayjs";
import { IconLicense } from "@tabler/icons-react";
import type { LapsingPermit } from "@/lib/registry/queries";

const when = (p: LapsingPermit) => dayjs(p.listingEnd).format("D MMM");
const named = (rows: LapsingPermit[], verb: string) =>
  rows.map((p) => `${p.name} ${verb} ${when(p)}`).join(" · ");

/**
 * The sentence the banner shows, or null when there is nothing to say.
 *
 * Named while a person could act on each one individually, counted after that:
 * 389 permits share a single expiry date, and listing them is not a
 * notification. Exported so the counting and the plurals can be tested without
 * standing up the component.
 */
export function lapsingMessage(permits: LapsingPermit[]): string | null {
  if (permits.length === 0) return null;

  const expired = permits.filter((p) => p.daysLeft < 0);
  // Soonest first out of the query, so the head of each list is the date that
  // matters.
  const upcoming = permits.filter((p) => p.daysLeft >= 0);

  const expiredText =
    expired.length === 0
      ? null
      : expired.length <= 3
        ? named(expired, "expired")
        : `${expired.length} permits have expired`;

  let upcomingText: string | null = null;
  if (upcoming.length > 0 && upcoming.length <= 3) {
    upcomingText = named(upcoming, "expires");
  } else if (upcoming.length > 0) {
    const soonest = upcoming[0].listingEnd;
    const sameDay = upcoming.filter((p) => p.listingEnd === soonest).length;
    const head =
      sameDay === 1
        ? `1 permit expires ${when(upcoming[0])}`
        : `${sameDay} permits expire ${when(upcoming[0])}`;
    upcomingText =
      sameDay === upcoming.length
        ? head
        : `${head}, ${upcoming.length - sameDay} more within 60 days`;
  }

  return [expiredText, upcomingText].filter(Boolean).join(" · ");
}

/**
 * A permit lapsing is worth interrupting someone about — it only showed on the
 * permits screen, which nobody opens unless they already suspect a problem.
 *
 * This is the whole notification. The expiry cron computes the same report
 * nightly and hands it to Resend, which is not configured, so it has been
 * discarding a 393-permit warning every night since it was written. Rather
 * than turning email on, the report is put where the people who can act on it
 * already are.
 *
 * Fed from the server layout rather than fetched here, so it renders with the
 * first HTML — the same reason that layout is a server component. That layout
 * only renders it for someone holding issuePermit, so the link always points at
 * a screen the reader can act on.
 */
export function LapsingPermitsBanner({
  permits,
}: {
  permits: LapsingPermit[];
}) {
  const message = lapsingMessage(permits);
  if (!message) return null;

  return (
    <Alert
      color={permits.some((p) => p.daysLeft < 0) ? "red" : "orange"}
      variant="light"
      icon={<IconLicense size={18} />}
      mb="md"
    >
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text size="sm">{message}</Text>
        <Anchor component={Link} href="/admin/permits" size="sm">
          Renew them
        </Anchor>
      </Group>
    </Alert>
  );
}
