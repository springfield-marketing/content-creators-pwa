"use client";

// Shared activity timeline rendering, grouped by day. Fed by /api/me/activity
// (own) or /api/admin/activity (per-creator or global).

import { Anchor, Badge, Group, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";

export type ActivityEvent = {
  at: string;
  actor: string | null;
  subject: string | null;
  action: string;
  entity: string;
  label: string;
  detail: string | null;
  url: string | null;
};

const actionColor: Record<string, string> = {
  approve: "green",
  request_changes: "orange",
  resubmit: "blue",
  cancel: "red",
  cancel_requested: "red",
  mark_posted: "teal",
  reassign: "grape",
};

export function ActivityList({
  events,
  showSubject,
}: {
  events: ActivityEvent[];
  showSubject?: boolean;
}) {
  if (events.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No activity for this month.
      </Text>
    );
  }

  // Events arrive newest-first; group consecutive same-day runs.
  const days: [string, ActivityEvent[]][] = [];
  for (const e of events) {
    const day = dayjs(e.at).format("ddd D MMM");
    if (days.length === 0 || days[days.length - 1][0] !== day) days.push([day, []]);
    days[days.length - 1][1].push(e);
  }

  return (
    <Stack gap="lg">
      {days.map(([day, evs]) => (
        <div key={day}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8}>
            {day}
          </Text>
          <Stack gap={10}>
            {evs.map((e, i) => (
              <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                <Text size="xs" c="dimmed" w={44} style={{ flexShrink: 0 }}>
                  {dayjs(e.at).format("HH:mm")}
                </Text>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6} wrap="wrap">
                    <Badge
                      size="xs"
                      variant="light"
                      color={actionColor[e.action] ?? "gray"}
                    >
                      {e.action.replace(/_/g, " ")}
                    </Badge>
                    <Text size="sm" fw={500}>
                      {e.label}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {e.actor ?? "System"}
                    {showSubject && e.subject ? ` · ${e.subject}` : ""}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </Text>
                </div>
                {e.url && (
                  <Anchor href={e.url} target="_blank" size="xs" style={{ flexShrink: 0 }}>
                    open
                  </Anchor>
                )}
              </Group>
            ))}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

export const ACTIVITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "approvals", label: "Approvals" },
  { value: "revisions", label: "Revisions" },
  { value: "logged", label: "Logged" },
  { value: "shoots", label: "Shoots" },
];

export function filterActivity(events: ActivityEvent[], f: string): ActivityEvent[] {
  if (f === "approvals") return events.filter((e) => e.action === "approve");
  if (f === "revisions")
    return events.filter((e) =>
      ["request_changes", "resubmit"].includes(e.action)
    );
  if (f === "logged")
    return events.filter((e) => e.entity === "deliverable" && e.action === "create");
  if (f === "shoots") return events.filter((e) => e.entity === "booking");
  return events;
}
