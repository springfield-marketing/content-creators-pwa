"use client";

// Screen 14 — Executive summary, read-only, on live KPIs. Trends deepen as
// nightly snapshots accumulate.

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Card,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import type { CreatorKpis } from "@/lib/kpis";

export default function ExecutiveSummary() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [result, setResult] = useState<{ key: string; kpis: CreatorKpis[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/kpis?month=${month}`)
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

  const tiles = [
    { label: "Shoots completed", value: total((k) => k.completed), target: total((k) => k.targetShoots) },
    { label: "Deliverables approved", value: total((k) => k.approved), target: total((k) => k.targetDeliverables) },
    { label: "Posted", value: total((k) => k.posted), target: total((k) => k.targetPosted) },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Executive summary</Title>
          <Text size="sm" c="dimmed">
            Team KPI attainment — live
          </Text>
        </div>
        <Select
          data={months}
          value={month}
          onChange={(v) => v && setMonth(v)}
          allowDeselect={false}
          maw={170}
        />
      </Group>

      {data === null ? (
        <Skeleton height={400} radius="lg" />
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
            {tiles.map((t) => {
              const pct =
                t.target > 0 ? Math.round((t.value / t.target) * 100) : 0;
              return (
                <Card key={t.label}>
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      {t.label}
                    </Text>
                    <Group align="baseline" gap={6}>
                      <Text fz={30} fw={700} lh={1}>
                        {t.value}
                      </Text>
                      <Text size="sm" c="dimmed">
                        / {t.target || "—"} target
                      </Text>
                    </Group>
                    <Progress
                      value={Math.min(100, pct)}
                      size="sm"
                      color={pct >= 100 ? "green" : "brand"}
                    />
                    <Text size="xs" c="dimmed">
                      {t.target > 0 ? `${pct}% attainment` : "No targets set"}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>

          <Card padding="sm">
            <Text fw={600} px="xs" pt={4} pb="xs">
              Attainment by creator — {dayjs(`${month}-01`).format("MMMM YYYY")}
            </Text>
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Creator</Table.Th>
                    <Table.Th>Shoots</Table.Th>
                    <Table.Th>Deliverables</Table.Th>
                    <Table.Th>Posted</Table.Th>
                    <Table.Th>Cancellations</Table.Th>
                    <Table.Th>Overall</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.map((k) => {
                    const parts = [
                      k.targetShoots > 0 ? k.completed / k.targetShoots : null,
                      k.targetDeliverables > 0 ? k.approved / k.targetDeliverables : null,
                      k.targetPosted > 0 ? k.posted / k.targetPosted : null,
                    ].filter((x): x is number => x !== null);
                    const overall = parts.length
                      ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
                      : 0;
                    return (
                      <Table.Tr key={k.creatorId}>
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {k.creatorName}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {k.completed} / {k.targetShoots || "—"}
                        </Table.Td>
                        <Table.Td>
                          {k.approved} / {k.targetDeliverables || "—"}
                        </Table.Td>
                        <Table.Td>
                          {k.posted} / {k.targetPosted || "—"}
                        </Table.Td>
                        <Table.Td>{k.cancelled}</Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Progress
                              value={Math.min(100, overall)}
                              size="sm"
                              w={80}
                              color={overall >= 100 ? "green" : "brand"}
                            />
                            <Text size="sm">{overall}%</Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          <Text size="xs" c="dimmed">
            Month-over-month trends build up automatically from nightly KPI
            snapshots.
          </Text>
        </>
      )}
    </Stack>
  );
}
