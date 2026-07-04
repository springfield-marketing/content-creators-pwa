"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Center,
  Group,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconCalendarOff, IconInfoCircle } from "@tabler/icons-react";
import { useCreatorProfile } from "@/lib/use-creator";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

type Slot = { start: string; end: string; date: string; label: string };
type Availability = {
  durationMinutes: number;
  horizonDays: number;
  slots: Slot[];
};

// Screen 2 — Pick a time: live availability (§B12.3). The agent picks the
// shoot type FIRST because slot length depends on it.
function PickTime() {
  const { creator: slug } = useParams<{ creator: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { creator, state } = useCreatorProfile(slug);

  const [shootType, setShootType] = useState<DbShootType>("photo");
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const requestKey = `${slug}:${shootType}`;
  const [result, setResult] = useState<{
    key: string;
    availability: Availability | null;
    down: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/creators/${slug}/availability?type=${shootType}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((a: Availability) => {
        if (!cancelled)
          setResult({ key: `${slug}:${shootType}`, availability: a, down: false });
      })
      .catch(() => {
        if (!cancelled)
          setResult({ key: `${slug}:${shootType}`, availability: null, down: true });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, shootType]);

  // A stale result (from a previous shoot type) counts as still loading.
  const current = result?.key === requestKey ? result : null;
  const availability = current?.availability ?? null;
  const loadState: "loading" | "ready" | "down" = !current
    ? "loading"
    : current.down
      ? "down"
      : "ready";

  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of availability?.slots ?? []) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return map;
  }, [availability]);

  if (state === "loading") {
    return (
      <Stack gap="md">
        <Group>
          <Skeleton height={56} width={56} circle />
          <Skeleton height={28} width={180} />
        </Group>
        <Skeleton height={36} radius="md" />
        <Skeleton height={64} radius="md" />
        <Skeleton height={120} radius="lg" />
      </Stack>
    );
  }

  if (state === "not_found" || !creator) {
    return (
      <Alert color="red" variant="light">
        This creator is not available for booking.
      </Alert>
    );
  }

  const rescheduleId = searchParams.get("reschedule");
  const rtoken = searchParams.get("rtoken");
  const days = Array.from({ length: 14 }, (_, i) =>
    dayjs().startOf("day").add(i, "day")
  );
  const firstAvailable = [...slotsByDate.keys()].sort()[0] ?? null;
  const activeDay = selectedDay ?? firstAvailable;
  const daySlots = activeDay ? (slotsByDate.get(activeDay) ?? []) : [];

  const pickSlot = async (slot: Slot) => {
    // Reschedule (§B12.1): atomic re-book — same booking, new times.
    if (rescheduleId && rtoken) {
      const res = await fetch(`/api/bookings/${rescheduleId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rtoken, shootType, start: slot.start }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifications.show({
          title: "Couldn't reschedule",
          message: body.error ?? "Please try another slot.",
          color: res.status === 409 ? "orange" : "red",
        });
        return;
      }
      notifications.show({
        title: "Booking rescheduled",
        message: "Everyone's calendar has been updated.",
        color: "green",
      });
      router.push(`/booking/${rescheduleId}?token=${encodeURIComponent(rtoken)}`);
      return;
    }

    const params = new URLSearchParams({
      start: slot.start,
      end: slot.end,
      type: shootType,
    });
    router.push(`/book/${creator.slug}/details?${params.toString()}`);
  };

  return (
    <Stack gap="lg">
      <Group>
        <Avatar color={creator.color} radius="xl" size="lg">
          {initials(creator.name)}
        </Avatar>
        <Stack gap={2}>
          <Title order={2} fz="xl">
            {creator.name}
          </Title>
          <Text size="xs" c="dimmed">
            {creator.settings.workingHours}
          </Text>
        </Stack>
      </Group>

      {rescheduleId && (
        <Alert variant="light" color="yellow" icon={<IconInfoCircle size={18} />}>
          You are picking a new time for an existing booking. The old slot is
          released once the new one is confirmed.
        </Alert>
      )}

      <div>
        <Text size="sm" fw={500} mb={4}>
          Shoot type
        </Text>
        <SegmentedControl
          fullWidth
          value={shootType}
          onChange={(v) => {
            setShootType(v as DbShootType);
            setSelectedDay(null);
          }}
          data={(Object.keys(dbShootTypeLabel) as DbShootType[]).map((t) => ({
            value: t,
            label: dbShootTypeLabel[t],
          }))}
        />
        {availability && (
          <Text size="xs" c="dimmed" mt={4}>
            {dbShootTypeLabel[shootType]} shoots with {creator.name.split(" ")[0]}{" "}
            take {availability.durationMinutes} minutes.
          </Text>
        )}
      </div>

      {loadState === "down" ? (
        <Alert color="red" variant="light" icon={<IconCalendarOff size={18} />}>
          Live availability is temporarily unavailable, so bookings are paused —
          please try again in a few minutes.
        </Alert>
      ) : loadState === "loading" ? (
        <Stack gap="md">
          <Skeleton height={64} radius="md" />
          <Skeleton height={120} radius="lg" />
        </Stack>
      ) : (
        <>
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as "week" | "month")}
            data={[
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
            ]}
            fullWidth
          />

          {view === "week" ? (
            <ScrollArea type="never">
              <Group gap="xs" wrap="nowrap">
                {days.map((d) => {
                  const dateStr = d.format("YYYY-MM-DD");
                  const bookable = slotsByDate.has(dateStr);
                  const active = dateStr === activeDay;
                  return (
                    <UnstyledButton
                      key={dateStr}
                      disabled={!bookable}
                      onClick={() => setSelectedDay(dateStr)}
                    >
                      <Stack
                        gap={2}
                        align="center"
                        px="sm"
                        py={6}
                        style={{
                          borderRadius: "var(--mantine-radius-md)",
                          border: `1px solid ${
                            active
                              ? "var(--mantine-color-brand-6)"
                              : "var(--mantine-color-default-border)"
                          }`,
                          background: active
                            ? "var(--mantine-color-brand-6)"
                            : undefined,
                          opacity: bookable ? 1 : 0.35,
                          minWidth: 56,
                        }}
                      >
                        <Text size="xs" c={active ? "white" : "dimmed"}>
                          {d.format("ddd")}
                        </Text>
                        <Text fw={600} c={active ? "white" : undefined}>
                          {d.format("D")}
                        </Text>
                      </Stack>
                    </UnstyledButton>
                  );
                })}
              </Group>
            </ScrollArea>
          ) : (
            <Center>
              <DatePicker
                value={activeDay}
                onChange={(value) => value && setSelectedDay(value)}
                minDate={dayjs().format("YYYY-MM-DD")}
                maxDate={dayjs()
                  .add(availability?.horizonDays ?? 28, "day")
                  .format("YYYY-MM-DD")}
                excludeDate={(date) => !slotsByDate.has(date)}
              />
            </Center>
          )}

          <Box>
            {activeDay ? (
              <>
                <Text fw={600} mb="xs">
                  {dayjs(activeDay).format("dddd, MMMM D")}
                </Text>
                {daySlots.length > 0 ? (
                  <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="xs">
                    {daySlots.map((slot) => (
                      <Button
                        key={slot.start}
                        variant="light"
                        onClick={() => pickSlot(slot)}
                      >
                        {slot.label}
                      </Button>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Alert
                    variant="light"
                    color="gray"
                    icon={<IconCalendarOff size={18} />}
                  >
                    No available slots on this day — pick another date.
                  </Alert>
                )}
              </>
            ) : (
              <Alert
                variant="light"
                color="gray"
                icon={<IconCalendarOff size={18} />}
              >
                No {dbShootTypeLabel[shootType].toLowerCase()} slots in the next{" "}
                {availability?.horizonDays ?? 28} days.
              </Alert>
            )}
          </Box>

          <Text size="xs" c="dimmed">
            Times are live from {creator.name.split(" ")[0]}&apos;s calendar —
            existing bookings, travel buffers, and a{" "}
            {creator.settings.minNoticeHours}h minimum notice are already
            accounted for.
          </Text>
        </>
      )}
    </Stack>
  );
}

export default function Page() {
  return (
    <Suspense>
      <PickTime />
    </Suspense>
  );
}
