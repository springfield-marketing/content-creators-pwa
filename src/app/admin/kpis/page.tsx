"use client";

import dayjs from "dayjs";
import {
  Button,
  Card,
  Divider,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import {
  creatorById,
  currentMonth,
  kpis,
  targets,
  type KpiRow,
} from "@/lib/mock-data";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function exportCsv() {
  const header =
    "creator,month,booked,completed,cancelled,no_shows,submitted,approved,revision_rate,posted,post_rate,avg_turnaround_h";
  const rows = kpis.map((k) =>
    [
      creatorById(k.creatorId)?.name,
      k.month,
      k.shootsBooked,
      k.shootsCompleted,
      k.shootsCancelled,
      k.noShows,
      k.submitted,
      k.approved,
      k.revisionRate,
      k.postedCount,
      k.postRate,
      k.avgTurnaroundHours,
    ].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kpis-${currentMonth}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function CreatorKpiCard({ kpi }: { kpi: KpiRow }) {
  const creator = creatorById(kpi.creatorId)!;
  const target = targets.find(
    (t) => t.creatorId === kpi.creatorId && t.month === kpi.month
  )!;

  const bars = [
    { label: "Shoots completed", value: kpi.shootsCompleted, target: target.shoots },
    { label: "Deliverables approved", value: kpi.approved, target: target.deliverables },
    { label: "Posted", value: kpi.postedCount, target: target.posted },
  ];

  const cancelledDetail = Object.entries(kpi.cancellationReasons)
    .map(([reason, n]) => `${reason}: ${n}`)
    .join(" · ");

  const facts = [
    { label: "Booked", value: String(kpi.shootsBooked) },
    {
      label: "Cancelled",
      value: String(kpi.shootsCancelled),
      tooltip: cancelledDetail || undefined,
    },
    { label: "No-shows", value: String(kpi.noShows) },
    { label: "Submitted", value: String(kpi.submitted) },
    { label: "Revision rate", value: pct(kpi.revisionRate) },
    { label: "Post rate", value: pct(kpi.postRate) },
    { label: "Avg turnaround", value: `${kpi.avgTurnaroundHours}h` },
  ];

  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>{creator.name}</Text>

        {bars.map((b) => {
          const p = Math.min(100, Math.round((b.value / b.target) * 100));
          return (
            <div key={b.label}>
              <Group justify="space-between" mb={2}>
                <Text size="xs" c="dimmed">
                  {b.label}
                </Text>
                <Text size="xs" fw={600}>
                  {b.value} / {b.target}
                </Text>
              </Group>
              <Progress value={p} size="sm" color={p >= 100 ? "green" : "brand"} />
            </div>
          );
        })}

        <Divider />

        <SimpleGrid cols={4} spacing="xs">
          {facts.map((f) => (
            <Tooltip
              key={f.label}
              label={f.tooltip}
              disabled={!f.tooltip}
              multiline
              maw={220}
            >
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

// Screen 9 — KPI dashboard: per creator, per month, plus team totals.
export default function KpiDashboard() {
  const total = (fn: (k: KpiRow) => number) => kpis.reduce((s, k) => s + fn(k), 0);
  const teamStats = [
    { label: "Shoots completed", value: total((k) => k.shootsCompleted) },
    { label: "Deliverables approved", value: total((k) => k.approved) },
    { label: "Posted", value: total((k) => k.postedCount) },
    { label: "Cancellations", value: total((k) => k.shootsCancelled) },
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
            data={[
              {
                value: currentMonth,
                label: dayjs(currentMonth).format("MMMM YYYY"),
              },
            ]}
            value={currentMonth}
            allowDeselect={false}
            maw={170}
          />
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        </Group>
      </Group>

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
        {kpis.map((k) => (
          <CreatorKpiCard key={k.creatorId} kpi={k} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
