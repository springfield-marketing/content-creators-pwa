"use client";

// Screen: Activity — per-creator or global history, month by month.

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Badge,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
  ActivityList,
  ACTIVITY_FILTERS,
  filterActivity,
  type ActivityEvent,
} from "@/components/ActivityList";

type Creator = { id: string; name: string };

export default function AdminActivity() {
  const [month, setMonth] = useState(() => dayjs().format("YYYY-MM"));
  const [creators, setCreators] = useState<Creator[]>([]);
  const [creatorId, setCreatorId] = useState<string>(""); // "" = all activity
  const [data, setData] = useState<{
    key: string;
    events: ActivityEvent[];
  } | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/creators")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: { id: string; name: string; isActive: boolean }[]) =>
        setCreators(
          rows.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))
        )
      )
      .catch(() => setCreators([]));
  }, []);

  const key = `${month}|${creatorId}`;
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ month });
    if (creatorId) qs.set("creatorId", creatorId);
    fetch(`/api/admin/activity?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData({ key, events: d.events }))
      .catch(() => !cancelled && setData({ key, events: [] }));
    return () => {
      cancelled = true;
    };
  }, [month, creatorId, key]);

  const shift = (n: number) =>
    setMonth(dayjs(`${month}-01`).add(n, "month").format("YYYY-MM"));
  const isThisMonth = month === dayjs().format("YYYY-MM");
  const loading = data?.key !== key;
  const shown = filterActivity(loading ? [] : data!.events, filter);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Activity</Title>
        <Text size="sm" c="dimmed">
          What&apos;s been on each creator&apos;s plate — or everyone at once.
        </Text>
      </div>

      <Group justify="space-between" align="flex-end">
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
        <Group gap="xs">
          <Select
            placeholder="All activity"
            data={[
              { value: "", label: "All activity" },
              ...creators.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={creatorId}
            onChange={(v) => setCreatorId(v ?? "")}
            maw={220}
            allowDeselect={false}
          />
          <Select
            data={ACTIVITY_FILTERS}
            value={filter}
            onChange={(v) => setFilter(v ?? "all")}
            maw={150}
            allowDeselect={false}
          />
        </Group>
      </Group>

      {loading ? (
        <Skeleton height={260} radius="lg" />
      ) : (
        <ActivityList events={shown} showSubject={creatorId === ""} />
      )}
    </Stack>
  );
}
