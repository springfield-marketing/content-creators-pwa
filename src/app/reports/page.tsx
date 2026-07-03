"use client";

import dayjs from "dayjs";
import {
  Card,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  creatorById,
  currentMonth,
  kpis,
  targets,
} from "@/lib/mock-data";

// Mock 6-month history ending at the current month (stage 3 computes this).
const MONTHS = Array.from({ length: 6 }, (_, i) =>
  dayjs(currentMonth).subtract(5 - i, "month")
);
const approvedTrend = [34, 41, 38, 47, 44, 43];
const cancellationTrend = [9, 6, 8, 5, 7, 5];

// Single-series trend bars: no legend needed (the title names the series),
// per-bar tooltip, direct label on the latest month only.
function TrendBars({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <Group gap={6} align="flex-end" justify="center" h={120} mt="xs">
      {values.map((v, i) => {
        const isLatest = i === values.length - 1;
        return (
          <Tooltip
            key={i}
            label={`${MONTHS[i].format("MMMM YYYY")}: ${v}`}
            withArrow
          >
            <Stack
              gap={2}
              align="center"
              justify="flex-end"
              h="100%"
              style={{ flex: 1, maxWidth: 64 }}
              aria-label={`${MONTHS[i].format("MMMM")}: ${v}`}
            >
              {isLatest && (
                <Text size="xs" fw={600}>
                  {v}
                </Text>
              )}
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(4, (v / max) * 90)}%`,
                  background: "var(--mantine-color-brand-filled)",
                  borderRadius: "4px 4px 0 0",
                  opacity: isLatest ? 1 : 0.75,
                }}
              />
              <Text size="xs" c="dimmed">
                {MONTHS[i].format("MMM")}
              </Text>
            </Stack>
          </Tooltip>
        );
      })}
    </Group>
  );
}

// Screen 14 — Executive summary: read-only, monthly, no editing rights.
export default function ExecutiveSummary() {
  const sum = (fn: (i: number) => number) =>
    kpis.reduce((s, _, i) => s + fn(i), 0);

  const teamTiles = [
    {
      label: "Shoots completed",
      value: sum((i) => kpis[i].shootsCompleted),
      target: sum(
        (i) => targets.find((t) => t.creatorId === kpis[i].creatorId)!.shoots
      ),
    },
    {
      label: "Deliverables approved",
      value: sum((i) => kpis[i].approved),
      target: sum(
        (i) =>
          targets.find((t) => t.creatorId === kpis[i].creatorId)!.deliverables
      ),
    },
    {
      label: "Posted",
      value: sum((i) => kpis[i].postedCount),
      target: sum(
        (i) => targets.find((t) => t.creatorId === kpis[i].creatorId)!.posted
      ),
    },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Executive summary</Title>
          <Text size="sm" c="dimmed">
            Team KPI attainment and trends
          </Text>
        </div>
        <Select
          data={[
            { value: currentMonth, label: dayjs(currentMonth).format("MMMM YYYY") },
          ]}
          value={currentMonth}
          allowDeselect={false}
          maw={170}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        {teamTiles.map((t) => {
          const pct = Math.round((t.value / t.target) * 100);
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
                    / {t.target} target
                  </Text>
                </Group>
                <Progress
                  value={Math.min(100, pct)}
                  size="sm"
                  color={pct >= 100 ? "green" : "brand"}
                />
                <Text size="xs" c="dimmed">
                  {pct}% attainment
                </Text>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Text fw={600}>Deliverables approved per month</Text>
          <TrendBars values={approvedTrend} />
        </Card>
        <Card>
          <Text fw={600}>Cancellations per month</Text>
          <TrendBars values={cancellationTrend} />
        </Card>
      </SimpleGrid>

      <Card padding="sm">
        <Text fw={600} px="xs" pt={4} pb="xs">
          Attainment by creator — {dayjs(currentMonth).format("MMMM YYYY")}
        </Text>
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Creator</Table.Th>
                <Table.Th>Shoots</Table.Th>
                <Table.Th>Deliverables</Table.Th>
                <Table.Th>Posted</Table.Th>
                <Table.Th>Overall</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {kpis.map((k) => {
                const t = targets.find((x) => x.creatorId === k.creatorId)!;
                const overall = Math.round(
                  ((k.shootsCompleted / t.shoots +
                    k.approved / t.deliverables +
                    k.postedCount / t.posted) /
                    3) *
                    100
                );
                return (
                  <Table.Tr key={k.creatorId}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {creatorById(k.creatorId)?.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {k.shootsCompleted} / {t.shoots}
                    </Table.Td>
                    <Table.Td>
                      {k.approved} / {t.deliverables}
                    </Table.Td>
                    <Table.Td>
                      {k.postedCount} / {t.posted}
                    </Table.Td>
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
    </Stack>
  );
}
