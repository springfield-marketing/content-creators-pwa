"use client";

// Screen 4b — Manage booking (secure link from the confirmation email).
// Real data via token-gated API; §B12.1 two-tier cancellation.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
  Skeleton,
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
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

type ManagedBooking = {
  id: string;
  creatorName: string;
  creatorSlug: string;
  agentName: string | null;
  start: string;
  end: string;
  shootType: DbShootType;
  projectName: string | null;
  locationType: "on_site" | "office";
  propertyAddress: string | null;
  notes: string | null;
  instantCancel: boolean;
  pendingCancellation: boolean;
};

function ManageBooking() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "invalid">(
    "loading"
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"none" | "cancelled" | "requested">(
    "none"
  );
  const [cancelOpen, { open: openCancel, close: closeCancel }] =
    useDisclosure(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${id}?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: ManagedBooking) => {
        if (cancelled) return;
        setBooking(b);
        setLoadState("ready");
      })
      .catch(() => !cancelled && setLoadState("invalid"));
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  if (loadState === "loading") {
    return (
      <Stack gap="md">
        <Skeleton height={28} width={200} />
        <Skeleton height={220} radius="lg" />
        <Skeleton height={60} radius="md" />
      </Stack>
    );
  }

  if (loadState === "invalid" || !booking) {
    return (
      <Alert color="red" variant="light">
        This booking link is invalid, expired, or the booking is no longer
        active. <Link href="/book">Make a new booking</Link>.
      </Alert>
    );
  }

  const start = dayjs(booking.start);
  const end = dayjs(booking.end);
  const pending = booking.pendingCancellation || outcome === "requested";

  const confirmCancel = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, reason }),
    });
    setSubmitting(false);
    closeCancel();
    if (res.ok) {
      const body = await res.json();
      setOutcome(body.outcome);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Your booking</Title>
        {outcome === "cancelled" ? (
          <Badge color="red" variant="light">
            Cancelled
          </Badge>
        ) : pending ? (
          <Badge color="yellow" variant="light">
            Cancellation requested
          </Badge>
        ) : (
          <Badge color="green" variant="light">
            Confirmed
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
                {dbShootTypeLabel[booking.shootType]}
              </Text>
            </div>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Creator
            </Text>
            <Text size="sm" fw={500}>
              {booking.creatorName}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Booked by
            </Text>
            <Text size="sm" fw={500}>
              {booking.agentName}
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
              {booking.locationType === "on_site"
                ? booking.propertyAddress
                : "Springfield office"}
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

      {outcome === "cancelled" ? (
        <Alert variant="light" color="red" icon={<IconInfoCircle size={18} />}>
          Your booking is cancelled. The calendar event has been removed,{" "}
          {booking.creatorName.split(" ")[0]} has been notified, and the slot is
          free for others. <Link href="/book">Book a new shoot</Link>.
        </Alert>
      ) : pending ? (
        <Alert variant="light" color="yellow" icon={<IconInfoCircle size={18} />}>
          Your cancellation request has been sent. Because the shoot is less
          than 24 hours away, the manager or creator needs to approve it —
          you&apos;ll be notified as soon as they decide.
        </Alert>
      ) : (
        <>
          <Alert
            variant="light"
            color={booking.instantCancel ? "blue" : "yellow"}
            icon={<IconClockHour4 size={18} />}
          >
            {booking.instantCancel
              ? "More than 24 hours until the shoot — cancelling or rescheduling is processed instantly and the slot is freed."
              : "Less than 24 hours until the shoot — cancellation becomes a request that the manager or creator approves."}
          </Alert>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <Button
              variant="default"
              component={Link}
              href={`/book/${booking.creatorSlug}?reschedule=${booking.id}&rtoken=${encodeURIComponent(token)}`}
            >
              Reschedule
            </Button>
            <Button color="red" variant="light" onClick={openCancel}>
              {booking.instantCancel ? "Cancel booking" : "Request cancellation"}
            </Button>
          </SimpleGrid>
        </>
      )}

      <Modal
        opened={cancelOpen}
        onClose={closeCancel}
        title={booking.instantCancel ? "Cancel booking" : "Request cancellation"}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {booking.instantCancel
              ? "This cancels the booking immediately — the calendar event is removed and the creator is notified."
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
              disabled={reason.trim().length < 3}
              loading={submitting}
              onClick={confirmCancel}
            >
              {booking.instantCancel ? "Cancel booking" : "Send request"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ManageBooking />
    </Suspense>
  );
}
