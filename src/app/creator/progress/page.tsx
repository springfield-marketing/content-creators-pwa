"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import {
  currentMonth,
  deliverables,
  kpis,
  targets,
} from "@/lib/mock-data";

// Mock logged-in creator until auth lands.
const ME = "c1";

// Screen 7 — My progress: no month-end surprises.
export default function MyProgress() {
  const [resubmitted, setResubmitted] = useState<string[]>([]);

  const kpi = kpis.find((k) => k.creatorId === ME && k.month === currentMonth)!;
  const target = targets.find(
    (t) => t.creatorId === ME && t.month === currentMonth
  )!;
  const revisions = deliverables.filter(
    (d) => d.creatorId === ME && d.status === "revision_requested"
  );
  const awaitingReview = kpi.submitted - kpi.approved;

  const stats = [
    {
      label: "Shoots completed",
      value: kpi.shootsCompleted,
      target: target.shoots,
      hint: null,
    },
    {
      label: "Deliverables approved",
      value: kpi.approved,
      target: target.deliverables,
      hint: awaitingReview > 0 ? `${awaitingReview} awaiting review` : null,
    },
    {
      label: "Posted",
      value: kpi.postedCount,
      target: target.posted,
      hint: null,
    },
  ];

  const resubmit = (id: string) => {
    setResubmitted((r) => [...r, id]);
    notifications.show({
      title: "Resubmitted",
      message: "Back in the manager's review queue.",
      color: "green",
    });
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>My progress</Title>
        <Text size="sm" c="dimmed">
          {dayjs().format("MMMM YYYY")}
        </Text>
      </div>

      {revisions.map((d) => {
        const done = resubmitted.includes(d.id);
        return done ? (
          <Alert key={d.id} variant="light" color="green">
            Resubmitted — the manager will take another look.
          </Alert>
        ) : (
          <Card
            key={d.id}
            style={{ borderColor: "var(--mantine-color-orange-4)" }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertTriangle
                  size={18}
                  color="var(--mantine-color-orange-6)"
                />
                <Text fw={600} size="sm">
                  Revision requested
                </Text>
                <Badge size="sm" color="orange" variant="light">
                  {d.type === "photo_set" ? "Photo set" : d.type}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                “{d.reviewComment}”
              </Text>
              <Group justify="space-between">
                <Anchor size="xs" href={d.url} target="_blank">
                  Open deliverable
                </Anchor>
                <Button
                  size="xs"
                  color="orange"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => resubmit(d.id)}
                >
                  Fix &amp; resubmit
                </Button>
              </Group>
            </Stack>
          </Card>
        );
      })}

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        {stats.map((s) => {
          const pct = Math.min(100, Math.round((s.value / s.target) * 100));
          return (
            <Card key={s.label}>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  {s.label}
                </Text>
                <Group align="baseline" gap={6}>
                  <Text fz={28} fw={700} lh={1}>
                    {s.value}
                  </Text>
                  <Text size="sm" c="dimmed">
                    / {s.target}
                  </Text>
                </Group>
                <Progress
                  value={pct}
                  color={pct >= 100 ? "green" : "brand"}
                  size="sm"
                />
                <Text size="xs" c="dimmed">
                  {pct}% of monthly target
                  {s.hint ? ` · ${s.hint}` : ""}
                </Text>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>

      <Text size="xs" c="dimmed">
        Approved deliverables count toward your monthly KPI the moment the
        manager approves them.
      </Text>
    </Stack>
  );
}
