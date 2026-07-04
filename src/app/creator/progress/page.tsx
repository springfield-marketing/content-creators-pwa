"use client";

// Screen 7 — My progress, on live KPIs (approved-only counting, decision #10).

import { useCallback, useEffect, useState } from "react";
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
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

type MyKpis = {
  completed: number;
  approved: number;
  submitted: number;
  posted: number;
  overtimeMinutes: number;
  targetShoots: number;
  targetDeliverables: number;
  targetPosted: number;
};
type Revision = {
  id: string;
  type: "photo_shoot" | "video_shoot";
  url: string;
  comment: string | null;
};

export default function MyProgress() {
  const [data, setData] = useState<{ kpis: MyKpis | null; revisions: Revision[] } | null>(null);
  const [resubmitting, setResubmitting] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetch("/api/me/kpis")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() =>
        notifications.show({
          title: "Couldn't load progress",
          message: "Try refreshing.",
          color: "red",
        })
      );
  }, []);
  useEffect(reload, [reload]);

  const resubmit = async (id: string) => {
    setResubmitting(id);
    const res = await fetch(`/api/me/deliverables/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    setResubmitting(null);
    if (res.ok) {
      notifications.show({
        title: "Resubmitted",
        message: "Back in the manager's review queue.",
        color: "green",
      });
      reload();
    }
  };

  if (data === null) {
    return (
      <Stack gap="md">
        <Skeleton height={32} width={160} />
        <Skeleton height={110} radius="lg" />
        <Skeleton height={110} radius="lg" />
      </Stack>
    );
  }

  const k = data.kpis;
  const stats = [
    {
      label: "Shoots completed",
      value: k?.completed ?? 0,
      target: k?.targetShoots ?? 0,
      hint: (k?.overtimeMinutes ?? 0) > 0 ? `${k!.overtimeMinutes}m overtime recorded` : null,
    },
    {
      label: "Deliverables approved",
      value: k?.approved ?? 0,
      target: k?.targetDeliverables ?? 0,
      hint:
        (k?.submitted ?? 0) - (k?.approved ?? 0) > 0
          ? `${k!.submitted - k!.approved} awaiting review`
          : null,
    },
    { label: "Posted", value: k?.posted ?? 0, target: k?.targetPosted ?? 0, hint: null },
  ];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>My progress</Title>
        <Text size="sm" c="dimmed">
          {dayjs().format("MMMM YYYY")}
        </Text>
      </div>

      {data.revisions.map((d) => (
        <Card key={d.id} style={{ borderColor: "var(--mantine-color-orange-4)" }}>
          <Stack gap="xs">
            <Group gap="xs">
              <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
              <Text fw={600} size="sm">
                Revision requested
              </Text>
              <Badge size="sm" color="orange" variant="light">
                {d.type === "photo_shoot" ? "Photo Shoot" : "Video Shoot"}
              </Badge>
            </Group>
            {d.comment && (
              <Text size="sm" c="dimmed">
                “{d.comment}”
              </Text>
            )}
            <Group justify="space-between">
              <Anchor size="xs" href={d.url} target="_blank">
                Open deliverable
              </Anchor>
              <Button
                size="xs"
                color="orange"
                leftSection={<IconRefresh size={14} />}
                loading={resubmitting === d.id}
                onClick={() => resubmit(d.id)}
              >
                Fix &amp; resubmit
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        {stats.map((s) => {
          const pct =
            s.target > 0 ? Math.min(100, Math.round((s.value / s.target) * 100)) : 0;
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
                    / {s.target || "—"}
                  </Text>
                </Group>
                <Progress value={pct} color={pct >= 100 ? "green" : "brand"} size="sm" />
                <Text size="xs" c="dimmed">
                  {s.target > 0 ? `${pct}% of monthly target` : "No target set"}
                  {s.hint ? ` · ${s.hint}` : ""}
                </Text>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>

      {data.revisions.length === 0 && (
        <Alert variant="light" color="green">
          Nothing waiting on you — approved work counts the moment the manager
          approves it.
        </Alert>
      )}
    </Stack>
  );
}
