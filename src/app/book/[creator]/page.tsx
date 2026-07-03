"use client";

import { Suspense, useState } from "react";
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
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconCalendarOff, IconInfoCircle } from "@tabler/icons-react";
import { creatorBySlug } from "@/lib/mock-data";
import { isDayBookable, slotsForDay, upcomingDays } from "@/lib/mock-slots";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

// Screen 2 — Pick a time: the creator's genuinely available slots.
function PickTime() {
  const { creator: slug } = useParams<{ creator: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const creator = creatorBySlug(slug);

  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  if (!creator || !creator.active) {
    return (
      <Alert color="red" variant="light">
        This creator is not available for booking.
      </Alert>
    );
  }

  const rescheduleId = searchParams.get("reschedule");
  const days = upcomingDays(14);
  const firstBookable = days.find((d) => slotsForDay(creator, d).length > 0);
  const activeDay = selectedDay
    ? dayjs(selectedDay)
    : (firstBookable ?? dayjs());
  const slots = slotsForDay(creator, activeDay);

  const pickSlot = (slot: dayjs.Dayjs) => {
    const params = new URLSearchParams({ start: slot.toISOString() });
    if (rescheduleId) params.set("reschedule", rescheduleId);
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
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {creator.settings.workingHours}
            </Text>
          </Group>
        </Stack>
      </Group>

      {rescheduleId && (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconInfoCircle size={18} />}
        >
          You are picking a new time for an existing booking. The old slot is
          released once the new one is confirmed.
        </Alert>
      )}

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
              const bookable = slotsForDay(creator, d).length > 0;
              const active = d.isSame(activeDay, "day");
              return (
                <UnstyledButton
                  key={d.format("YYYY-MM-DD")}
                  disabled={!bookable}
                  onClick={() => setSelectedDay(d.format("YYYY-MM-DD"))}
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
            value={activeDay.format("YYYY-MM-DD")}
            onChange={(value) => value && setSelectedDay(value)}
            minDate={dayjs().format("YYYY-MM-DD")}
            maxDate={dayjs()
              .add(creator.settings.horizonWeeks, "week")
              .format("YYYY-MM-DD")}
            excludeDate={(date) => !isDayBookable(creator, dayjs(date))}
          />
        </Center>
      )}

      <Box>
        <Text fw={600} mb="xs">
          {activeDay.format("dddd, MMMM D")}
        </Text>
        {slots.length > 0 ? (
          <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="xs">
            {slots.map((slot) => (
              <Button
                key={slot.toISOString()}
                variant="light"
                onClick={() => pickSlot(slot)}
              >
                {slot.format("HH:mm")}
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
      </Box>

      <Text size="xs" c="dimmed">
        Times shown already account for {creator.name.split(" ")[0]}&apos;s
        existing bookings, travel buffers, and a{" "}
        {creator.settings.minNoticeHours}h minimum notice.
      </Text>
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
