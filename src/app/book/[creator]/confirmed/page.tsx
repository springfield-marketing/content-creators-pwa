"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import {
  Alert,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCalendarCheck,
  IconCircleCheck,
  IconMail,
} from "@tabler/icons-react";
import { shootTypeLabel, type ShootType } from "@/lib/mock-data";
import { useCreatorProfile } from "@/lib/use-creator";

// Screen 4 — Confirmation: summary + "it's in your calendar".
function Confirmed() {
  const { creator: slug } = useParams<{ creator: string }>();
  const searchParams = useSearchParams();
  const { creator, state } = useCreatorProfile(slug);

  const start = searchParams.get("start");
  const type = (searchParams.get("type") ?? "photo") as ShootType;
  const agent = searchParams.get("agent") ?? "";
  const project = searchParams.get("project") ?? "";
  const location = searchParams.get("location") ?? "";
  const wasReschedule = searchParams.get("reschedule") !== null;

  if (state === "loading") {
    return null;
  }

  if (!creator || !start) {
    return (
      <Alert color="red" variant="light">
        Nothing to confirm — start again from the booking page.
      </Alert>
    );
  }

  const slot = dayjs(start);
  const duration =
    type === "video"
      ? creator.settings.videoDuration
      : creator.settings.photoDuration;

  const rows = [
    ["Project", project],
    ["Creator", creator.name],
    ["Agent", agent],
    ["Date", slot.format("dddd, MMMM D YYYY")],
    [
      "Time",
      `${slot.format("HH:mm")}–${slot.add(duration, "minute").format("HH:mm")}`,
    ],
    ["Shoot type", shootTypeLabel[type]],
    ["Location", location],
  ];

  return (
    <Stack gap="lg" align="center" ta="center">
      <ThemeIcon size={64} radius="xl" variant="light" color="green">
        <IconCircleCheck size={40} stroke={1.5} />
      </ThemeIcon>
      <Stack gap={4}>
        <Title order={2}>
          {wasReschedule ? "Booking rescheduled" : "Booking confirmed"}
        </Title>
        <Text c="dimmed">
          It&apos;s in your calendar — and in {creator.name.split(" ")[0]}&apos;s.
        </Text>
      </Stack>

      <Card w="100%" maw={420} ta="left">
        <Stack gap="xs">
          {rows.map(([label, value]) => (
            <Group key={label} justify="space-between" wrap="nowrap">
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <Text size="sm" fw={500} ta="right">
                {value}
              </Text>
            </Group>
          ))}
          <Divider my={4} />
          <Group gap="xs" wrap="nowrap">
            <IconMail size={16} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed" ta="left">
              A calendar invite is on its way to your email — works with
              Google, Outlook, and Apple calendars. The email includes a secure
              link to cancel or reschedule.
            </Text>
          </Group>
        </Stack>
      </Card>

      <Center>
        <Group>
          {/* Mock secure manage link — in production this is a signed, expiring URL */}
          <Button
            variant="default"
            component={Link}
            href="/booking/b6"
            leftSection={<IconCalendarCheck size={18} />}
          >
            Manage this booking
          </Button>
          <Button component={Link} href="/book" variant="light">
            Book another shoot
          </Button>
        </Group>
      </Center>
    </Stack>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Confirmed />
    </Suspense>
  );
}
