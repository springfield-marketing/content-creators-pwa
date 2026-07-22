"use client";

// Screen: Reviews — reviewer accountability summary + the full decision log,
// month by month. Part of the removable review-log feature.

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Anchor,
  Badge,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Card,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";

type ReviewRow = {
  at: string;
  submittedAt: string | null;
  reviewer: string | null;
  creator: string | null;
  decision: "approved" | "changes_requested";
  comment: string | null;
  permit: string | null;
  type: string | null;
  videoName: string | null;
  url: string | null;
};

const decisionLabel = {
  approved: "Approved",
  changes_requested: "Changes requested",
} as const;

function summarize(rows: ReviewRow[]) {
  const map = new Map<string, ReviewRow[]>();
  for (const r of rows) {
    const key = r.reviewer ?? "—";
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return [...map.entries()]
    .map(([reviewer, rs]) => {
      const approved = rs.filter((r) => r.decision === "approved").length;
      const changes = rs.length - approved;
      const decided = rs.filter((r) => r.submittedAt);
      const avgHours = decided.length
        ? decided.reduce(
            (s, r) => s + dayjs(r.at).diff(dayjs(r.submittedAt), "hour", true),
            0
          ) / decided.length
        : null;
      const videoApprovals = rs.filter(
        (r) => r.decision === "approved" && r.type === "video_shoot"
      );
      const withPermit = videoApprovals.filter((r) => r.permit).length;
      return {
        reviewer,
        approved,
        changes,
        revisionRate: rs.length ? changes / rs.length : 0,
        avgHours,
        permitPct: videoApprovals.length ? withPermit / videoApprovals.length : null,
      };
    })
    .sort((a, b) => b.approved + b.changes - (a.approved + a.changes));
}

export default function ReviewsScreen() {
  const [month, setMonth] = useState(() => dayjs().format("YYYY-MM"));
  const [data, setData] = useState<{ month: string; rows: ReviewRow[] } | null>(
    null
  );
  const [reviewer, setReviewer] = useState<string | null>(null);
  const [creator, setCreator] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/reviews?month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData({ month, rows: d.rows }))
      .catch(() => !cancelled && setData({ month, rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const shift = (n: number) =>
    setMonth(dayjs(`${month}-01`).add(n, "month").format("YYYY-MM"));
  const isThisMonth = month === dayjs().format("YYYY-MM");
  const loading = data?.month !== month;
  const rows = useMemo(
    () => (data?.month === month ? data.rows : []),
    [data, month]
  );

  const summary = useMemo(() => summarize(rows), [rows]);
  const reviewers = useMemo(
    () => [...new Set(rows.map((r) => r.reviewer).filter(Boolean))] as string[],
    [rows]
  );
  const creators = useMemo(
    () => [...new Set(rows.map((r) => r.creator).filter(Boolean))] as string[],
    [rows]
  );

  const shown = rows.filter(
    (r) =>
      (!reviewer || r.reviewer === reviewer) &&
      (!creator || r.creator === creator) &&
      (!decision || r.decision === decision) &&
      (!q || (r.comment ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Reviews</Title>
        <Text size="sm" c="dimmed">
          Who reviewed what, and the feedback they left. Signals to look closer,
          not scores.
        </Text>
      </div>

      <Group gap="xs">
        <ActionIcon variant="default" onClick={() => shift(-1)} aria-label="Previous month">
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Badge variant="light" size="lg">
          {dayjs(`${month}-01`).format("MMMM YYYY")}
        </Badge>
        <ActionIcon
          variant="default"
          onClick={() => shift(1)}
          disabled={isThisMonth}
          aria-label="Next month"
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>

      {loading ? (
        <Skeleton height={320} radius="lg" />
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {summary.map((s) => (
              <Card key={s.reviewer} withBorder padding="sm">
                <Text fw={600} size="sm" mb={6}>
                  {s.reviewer}
                </Text>
                <Group gap="lg">
                  <div>
                    <Text size="xs" c="dimmed">
                      Approved / changes
                    </Text>
                    <Text size="sm" fw={500}>
                      {s.approved} / {s.changes}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Revision rate
                    </Text>
                    <Text size="sm" fw={500}>
                      {Math.round(s.revisionRate * 100)}%
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Avg decision
                    </Text>
                    <Text size="sm" fw={500}>
                      {s.avgHours == null
                        ? "—"
                        : s.avgHours < 24
                          ? `${Math.round(s.avgHours)}h`
                          : `${Math.round(s.avgHours / 24)}d`}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Permit
                    </Text>
                    <Text size="sm" fw={500}>
                      {s.permitPct == null ? "—" : `${Math.round(s.permitPct * 100)}%`}
                    </Text>
                  </div>
                </Group>
              </Card>
            ))}
          </SimpleGrid>

          <Group gap="xs">
            <Select
              placeholder="Reviewer"
              clearable
              data={reviewers}
              value={reviewer}
              onChange={setReviewer}
              maw={170}
            />
            <Select
              placeholder="Creator"
              clearable
              data={creators}
              value={creator}
              onChange={setCreator}
              maw={170}
            />
            <Select
              placeholder="Decision"
              clearable
              data={[
                { value: "approved", label: "Approved" },
                { value: "changes_requested", label: "Changes requested" },
              ]}
              value={decision}
              onChange={setDecision}
              maw={180}
            />
            <TextInput
              placeholder="Search comments"
              leftSection={<IconSearch size={16} />}
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
              maw={220}
            />
          </Group>

          {shown.length === 0 ? (
            <Text c="dimmed" size="sm">
              No review decisions match.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={120}>When</Table.Th>
                    <Table.Th w={130}>Reviewer</Table.Th>
                    <Table.Th w={140}>Decision</Table.Th>
                    <Table.Th>Video</Table.Th>
                    <Table.Th>Comment / permit</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shown.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {dayjs(r.at).format("D MMM HH:mm")}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{r.reviewer ?? "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={r.decision === "approved" ? "green" : "orange"}
                        >
                          {decisionLabel[r.decision]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lh={1.3}>
                          {r.creator ?? "—"}
                          {r.videoName ? ` · ${r.videoName}` : ""}
                        </Text>
                        {r.url && (
                          <Anchor href={r.url} target="_blank" size="xs">
                            open
                          </Anchor>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {r.comment && (
                          <Text size="sm" lh={1.3}>
                            “{r.comment}”
                          </Text>
                        )}
                        {r.permit && (
                          <Text size="xs" c="dimmed">
                            Permit {r.permit}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </>
      )}
    </Stack>
  );
}
