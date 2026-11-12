"use client";

// Screen 7 — My progress, on live KPIs (approved-only counting, decision #10).
// Revisions, unfinished shoots and posting live on To do.

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
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

type MyKpis = {
  craft: "video" | "photo" | "both";
  completed: number;
  approved: number;
  submitted: number;
  posted: number;
  overtimeMinutes: number;
  imagesDelivered: number;
  targetShoots: number;
  targetDeliverables: number;
  targetPosted: number;
  targetImages: number;
};

export default function MyProgress() {
  const [data, setData] = useState<{ kpis: MyKpis | null } | null>(null);

  useEffect(() => {
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
    ...(k?.craft !== "photo"
      ? [
          {
            label: "Deliverables approved",
            value: k?.approved ?? 0,
            target: k?.targetDeliverables ?? 0,
            hint:
              (k?.submitted ?? 0) - (k?.approved ?? 0) > 0
                ? `${k!.submitted - k!.approved} awaiting review`
                : null,
          },
        ]
      : []),
    { label: "Posted", value: k?.posted ?? 0, target: k?.targetPosted ?? 0, hint: null },
    // Photo side, shown to photographers and to anyone doing both.
    ...(k && k.craft !== "video"
      ? [
          {
            label: "Images delivered",
            value: k.imagesDelivered,
            target: k.targetImages,
            hint: null,
          },
        ]
      : []),
  ];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>My progress</Title>
        <Text size="sm" c="dimmed">
          {dayjs().format("MMMM YYYY")}
        </Text>
      </div>

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
    </Stack>
  );
}
