"use client";

// Shared activity timeline: a day-sectioned table (time · type · activity ·
// who · link). Fed by /api/me/activity (own) or /api/admin/activity.

import { Fragment } from "react";
import { ActionIcon, Badge, Table, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
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
  create: "gray",
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
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={60}>Time</Table.Th>
            <Table.Th w={132}>Type</Table.Th>
            <Table.Th>Activity</Table.Th>
            <Table.Th w={showSubject ? 190 : 150}>By</Table.Th>
            <Table.Th w={44} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {days.map(([day, evs]) => (
            <Fragment key={day}>
              <Table.Tr bg="var(--mantine-color-default-hover)">
                <Table.Td colSpan={5} py={6}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    {day}
                  </Text>
                </Table.Td>
              </Table.Tr>
              {evs.map((e, i) => (
                <Table.Tr key={`${day}-${i}`}>
                  <Table.Td>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {dayjs(e.at).format("HH:mm")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={actionColor[e.action] ?? "gray"}
                    >
                      {e.action.replace(/_/g, " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500} lh={1.3}>
                      {e.label}
                    </Text>
                    {e.detail && (
                      <Text size="xs" c="dimmed" lh={1.3}>
                        {e.detail}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lh={1.3}>
                      {e.actor ?? "System"}
                    </Text>
                    {showSubject && e.subject && (
                      <Text size="xs" c="dimmed" lh={1.3}>
                        {e.subject}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {e.url && (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        component="a"
                        href={e.url}
                        target="_blank"
                        aria-label="Open deliverable"
                      >
                        <IconExternalLink size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Fragment>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
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
