"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarOff,
  IconMapPin,
  IconUserOff,
} from "@tabler/icons-react";
import {
  agentById,
  bookings,
  shootTypeLabel,
  type Booking,
} from "@/lib/mock-data";

// Mock logged-in creator until auth lands (matches the shell header).
const ME = "c1";

type LocalAction = "no_show" | "cancel_requested";

// Screen 5 — My schedule: today on top, upcoming below.
export default function MySchedule() {
  // Local mock state for actions taken this session.
  const [actions, setActions] = useState<Record<string, LocalAction>>({});
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [cancelOpen, { open: openCancel, close: closeCancel }] =
    useDisclosure(false);

  const mine = bookings
    .filter(
      (b) =>
        b.creatorId === ME &&
        (b.status === "confirmed" || b.status === "pending_cancellation") &&
        dayjs(b.end).isAfter(dayjs().startOf("day"))
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  const todays = mine.filter((b) => dayjs(b.start).isSame(dayjs(), "day"));
  const upcoming = mine.filter((b) => dayjs(b.start).isAfter(dayjs(), "day"));

  const markNoShow = (b: Booking) => {
    setActions((a) => ({ ...a, [b.id]: "no_show" }));
    notifications.show({
      title: "Marked as no-show",
      message: "The manager can see this on the KPI dashboard.",
      color: "orange",
    });
  };

  const askCancel = (b: Booking) => {
    setCancelTarget(b);
    setReason("");
    openCancel();
  };

  const confirmCancel = () => {
    if (cancelTarget) {
      setActions((a) => ({ ...a, [cancelTarget.id]: "cancel_requested" }));
      notifications.show({
        title: "Cancellation requested",
        message: "Sent to the manager — the agent will be notified.",
        color: "yellow",
      });
    }
    closeCancel();
  };

  const renderBooking = (b: Booking, isToday: boolean) => {
    const agent = agentById(b.agentId)!;
    const action = actions[b.id];
    const pending = b.status === "pending_cancellation";
    return (
      <Card key={b.id}>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600}>
              {dayjs(b.start).format(isToday ? "HH:mm" : "ddd D MMM, HH:mm")}–
              {dayjs(b.end).format("HH:mm")}
            </Text>
            <Group gap={6}>
              <Badge variant="light" size="sm">
                {shootTypeLabel[b.shootType]}
              </Badge>
              {action === "no_show" && (
                <Badge color="orange" size="sm">
                  No-show
                </Badge>
              )}
              {(action === "cancel_requested" || pending) && (
                <Badge color="yellow" size="sm">
                  Cancellation requested
                </Badge>
              )}
            </Group>
          </Group>

          <Text size="sm" fw={500}>
            {b.projectName}
          </Text>
          <Text size="sm" c="dimmed">
            {agent.name} — {agent.office}
          </Text>

          <Group gap={6} wrap="nowrap">
            <IconMapPin size={16} color="var(--mantine-color-dimmed)" />
            {b.location.kind === "onsite" ? (
              <Anchor
                size="sm"
                href={`https://maps.google.com/?q=${encodeURIComponent(b.location.address)}`}
                target="_blank"
              >
                {b.location.address}
              </Anchor>
            ) : (
              <Text size="sm">Office</Text>
            )}
          </Group>

          {b.notes && (
            <Text size="sm" c="dimmed">
              “{b.notes}”
            </Text>
          )}

          {!action && !pending && (
            <>
              <Divider />
              <Group gap="xs">
                {isToday && (
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    leftSection={<IconUserOff size={14} />}
                    onClick={() => markNoShow(b)}
                  >
                    Mark no-show
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<IconCalendarOff size={14} />}
                  onClick={() => askCancel(b)}
                >
                  Request cancellation
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Card>
    );
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Today</Title>
        <Text size="sm" c="dimmed">
          {dayjs().format("dddd, MMMM D")}
        </Text>
      </div>
      {todays.length > 0 ? (
        <Stack gap="sm">{todays.map((b) => renderBooking(b, true))}</Stack>
      ) : (
        <Alert variant="light" color="gray">
          No shoots today.
        </Alert>
      )}

      <Title order={3}>Upcoming</Title>
      {upcoming.length > 0 ? (
        <Stack gap="sm">{upcoming.map((b) => renderBooking(b, false))}</Stack>
      ) : (
        <Alert variant="light" color="gray">
          Nothing scheduled yet.
        </Alert>
      )}

      <Modal
        opened={cancelOpen}
        onClose={closeCancel}
        title="Request cancellation"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            The manager reviews the request and the agent is notified.
          </Text>
          <Textarea
            label="Reason"
            required
            placeholder="Why can't this shoot go ahead?"
            autosize
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCancel}>
              Back
            </Button>
            <Button
              color="red"
              disabled={reason.trim() === ""}
              onClick={confirmCancel}
            >
              Send request
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
