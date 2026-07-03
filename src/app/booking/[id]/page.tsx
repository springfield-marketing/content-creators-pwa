"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCalendarEvent,
  IconClockHour4,
  IconInfoCircle,
  IconMapPin,
} from "@tabler/icons-react";
import {
  agentById,
  bookingById,
  creatorById,
  shootTypeLabel,
} from "@/lib/mock-data";

// Screen 4b — Manage booking (secure link, no login).
// >24h before the shoot: cancellation is processed instantly.
// <24h: it becomes a request for the manager/creator to approve.
export default function ManageBooking() {
  const { id } = useParams<{ id: string }>();
  const booking = bookingById(id);

  const [cancelOpen, { open: openCancel, close: closeCancel }] =
    useDisclosure(false);
  const [reason, setReason] = useState("");
  // Local mock state: what happened after the user acted on this booking.
  const [outcome, setOutcome] = useState<"none" | "cancelled" | "requested">(
    "none"
  );

  if (!booking) {
    return (
      <Alert color="red" variant="light">
        This booking link is invalid or has expired.{" "}
        <Link href="/book">Make a new booking</Link>.
      </Alert>
    );
  }

  const creator = creatorById(booking.creatorId)!;
  const agent = agentById(booking.agentId)!;
  const start = dayjs(booking.start);
  const end = dayjs(booking.end);
  const hoursUntil = start.diff(dayjs(), "hour");
  const instant = hoursUntil >= 24;

  const confirmCancel = () => {
    setOutcome(instant ? "cancelled" : "requested");
    closeCancel();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Your booking</Title>
        {outcome === "none" && booking.status === "confirmed" && (
          <Badge color="green" variant="light">
            Confirmed
          </Badge>
        )}
        {outcome === "cancelled" && (
          <Badge color="red" variant="light">
            Cancelled
          </Badge>
        )}
        {outcome === "requested" && (
          <Badge color="yellow" variant="light">
            Cancellation requested
          </Badge>
        )}
      </Group>

      <Card>
        <Stack gap="sm">
          <Group gap="sm">
            <IconCalendarEvent size={20} color="var(--mantine-color-brand-6)" />
            <div>
              <Text fw={600}>{booking.projectName}</Text>
              <Text size="sm">{start.format("dddd, MMMM D YYYY")}</Text>
              <Text size="sm" c="dimmed">
                {start.format("HH:mm")}–{end.format("HH:mm")} ·{" "}
                {shootTypeLabel[booking.shootType]}
              </Text>
            </div>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Creator
            </Text>
            <Text size="sm" fw={500}>
              {creator.name}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Booked by
            </Text>
            <Text size="sm" fw={500}>
              {agent.name} — {agent.office}
            </Text>
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Group gap={6} wrap="nowrap">
              <IconMapPin size={16} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                Location
              </Text>
            </Group>
            <Text size="sm" fw={500} ta="right">
              {booking.location.kind === "onsite"
                ? booking.location.address
                : "Office"}
            </Text>
          </Group>
          {booking.notes && (
            <>
              <Divider />
              <Text size="sm" c="dimmed">
                “{booking.notes}”
              </Text>
            </>
          )}
        </Stack>
      </Card>

      {outcome === "none" ? (
        <>
          <Alert
            variant="light"
            color={instant ? "blue" : "yellow"}
            icon={<IconClockHour4 size={18} />}
          >
            {instant
              ? `More than 24 hours until the shoot — cancelling or rescheduling is processed instantly and the slot is freed.`
              : `Less than 24 hours until the shoot — changes become a request that the manager or creator approves.`}
          </Alert>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <Button
              variant="default"
              component={Link}
              href={`/book/${creator.slug}?reschedule=${booking.id}`}
            >
              Request reschedule
            </Button>
            <Button color="red" variant="light" onClick={openCancel}>
              Request cancellation
            </Button>
          </SimpleGrid>
        </>
      ) : outcome === "cancelled" ? (
        <Alert variant="light" color="red" icon={<IconInfoCircle size={18} />}>
          Your booking is cancelled. The calendar event has been removed,{" "}
          {creator.name.split(" ")[0]} has been notified, and the slot is free
          for others. <Link href="/book">Book a new shoot</Link>.
        </Alert>
      ) : (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconInfoCircle size={18} />}
        >
          Your cancellation request has been sent. Because the shoot is less
          than 24 hours away, the manager or creator needs to approve it —
          you&apos;ll get an email as soon as they do.
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
            {instant
              ? "This will cancel the booking immediately."
              : "The shoot is less than 24 hours away, so this becomes a request for approval."}
          </Text>
          <Textarea
            label="Reason"
            required
            placeholder="Why does this shoot need to be cancelled?"
            autosize
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCancel}>
              Keep booking
            </Button>
            <Button
              color="red"
              disabled={reason.trim() === ""}
              onClick={confirmCancel}
            >
              {instant ? "Cancel booking" : "Send request"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
