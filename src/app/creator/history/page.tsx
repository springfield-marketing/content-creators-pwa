"use client";

// Screen: My history — the creator's own activity timeline, month by month.

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

export default function MyHistory() {
  const [month, setMonth] = useState(() => dayjs().format("YYYY-MM"));
  const [data, setData] = useState<{
    month: string;
    events: ActivityEvent[];
  } | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/me/activity?month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData({ month, events: d.events }))
      .catch(() => !cancelled && setData({ month, events: [] }));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const shift = (n: number) =>
    setMonth(dayjs(`${month}-01`).add(n, "month").format("YYYY-MM"));
  const isThisMonth = month === dayjs().format("YYYY-MM");
  const loading = data?.month !== month;
  const shown = filterActivity(loading ? [] : data!.events, filter);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>My history</Title>
        <Text size="sm" c="dimmed">
          Everything on your plate, month by month.
        </Text>
      </div>

      <Group justify="space-between">
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
        <Select
          data={ACTIVITY_FILTERS}
          value={filter}
          onChange={(v) => setFilter(v ?? "all")}
          maw={150}
          allowDeselect={false}
        />
      </Group>

      {loading ? (
        <Skeleton height={260} radius="lg" />
      ) : (
        <ActivityList events={shown} />
      )}
    </Stack>
  );
}
