"use client";

// Screen 9 — KPI dashboard on live queries (§B6). Approved-only counting.

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Divider,
  Group,
  Progress,
  Select,
  Skeleton,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import type { CreatorKpis } from "@/lib/kpis";

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function exportCsv(month: string, kpis: CreatorKpis[]) {
  const header =
    "creator,month,booked,completed,cancelled,cancelled_by_creator,no_shows,overtime_minutes,submitted,approved,needs_revision,posted,avg_turnaround_h,target_shoots,target_deliverables,target_posted";
  const rows = kpis.map((k) =>
    [
      k.creatorName, month, k.booked, k.completed, k.cancelled, k.cancelledByCreator,
      k.noShows, k.overtimeMinutes, k.submitted, k.approved, k.needsRevision,
      k.posted, k.avgTurnaroundHours ?? "", k.targetShoots, k.targetDeliverables, k.targetPosted,
    ].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kpis-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function CreatorCard({ k }: { k: CreatorKpis }) {
  const bars = [
    { label: "Shoots completed", value: k.completed, target: k.targetShoots },
    { label: "Deliverables approved", value: k.approved, target: k.targetDeliverables },
    { label: "Posted", value: k.posted, target: k.targetPosted },
  ];
  const reasons = Object.entries(k.cancellationReasons)
    .map(([r, n]) => `${r}: ${n}`)
    .join(" · ");
  const facts = [
    { label: "Booked", value: String(k.booked) },
    { label: "Cancelled", value: String(k.cancelled), tooltip: reasons || undefined },
    { label: "No-shows", value: String(k.noShows) },
    { label: "Submitted", value: String(k.submitted) },
    { label: "Revisions", value: pct(k.needsRevision, k.submitted) },
    { label: "Post rate", value: pct(k.posted, k.approved) },
    { label: "Turnaround", value: k.avgTurnaroundHours != null ? `${k.avgTurnaroundHours}h` : "—" },
    { label: "Overtime", value: k.overtimeMinutes > 0 ? `${k.overtimeMinutes}m` : "—" },
  ];

  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>{k.creatorName}</Text>
        {bars.map((b) => {
          const p = b.target > 0 ? Math.min(100, Math.round((b.value / b.target) * 100)) : 0;
          return (
            <div key={b.label}>
              <Group justify="space-between" mb={2}>
                <Text size="xs" c="dimmed">
                  {b.label}
                </Text>
                <Text size="xs" fw={600}>
                  {b.value} / {b.target || "—"}
                </Text>
              </Group>
              <Progress value={p} size="sm" color={p >= 100 ? "green" : "brand"} />
            </div>
          );
        })}
        <Divider />
        <SimpleGrid cols={4} spacing="xs">
          {facts.map((f) => (
            <Tooltip key={f.label} label={f.tooltip} disabled={!f.tooltip} multiline maw={240}>
              <div>
                <Text size="xs" c="dimmed">
                  {f.label}
                </Text>
                <Text size="sm" fw={600} td={f.tooltip ? "underline dotted" : undefined}>
                  {f.value}
                </Text>
              </div>
            </Tooltip>
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

export default function KpiDashboard() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [result, setResult] = useState<{ key: string; kpis: CreatorKpis[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/kpis?month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setResult({ key: month, kpis: d.kpis }))
      .catch(() => !cancelled && setResult({ key: month, kpis: [] }));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const data = result?.key === month ? result.kpis : null;

  const months = Array.from({ length: 6 }, (_, i) => {
    const m = dayjs().subtract(i, "month");
    return { value: m.format("YYYY-MM"), label: m.format("MMMM YYYY") };
  });

  const total = (fn: (k: CreatorKpis) => number) =>
    (data ?? []).reduce((s, k) => s + fn(k), 0);
  const teamStats = [
    { label: "Shoots completed", value: total((k) => k.completed) },
    { label: "Deliverables approved", value: total((k) => k.approved) },
    { label: "Posted", value: total((k) => k.posted) },
    { label: "Cancellations", value: total((k) => k.cancelled) },
    { label: "No-shows", value: total((k) => k.noShows) },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>KPI dashboard</Title>
          <Text size="sm" c="dimmed">
            Live — recalculates as work is approved
          </Text>
        </div>
        <Group>
          <Select
            data={months}
            value={month}
            onChange={(v) => v && setMonth(v)}
            allowDeselect={false}
            maw={170}
          />
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            disabled={!data}
            onClick={() => data && exportCsv(month, data)}
          >
            Export CSV
          </Button>
        </Group>
      </Group>

      {data === null ? (
        <Skeleton height={400} radius="lg" />
      ) : (
        <>
          <Card padding="sm">
            <Group justify="space-around">
              {teamStats.map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <Text fz={24} fw={700} lh={1.2}>
                    {s.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {s.label}
                  </Text>
                </div>
              ))}
            </Group>
          </Card>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {data.map((k) => (
              <CreatorCard key={k.creatorId} k={k} />
            ))}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
