"use client";

// Screen 5 — My schedule, on real data. Actions: mark no-show, mark done
// (with overtime prompt, decision #8), direct cancel (decision #12).

import { useCallback, useEffect, useState } from "react";
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
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarOff,
  IconCheck,
  IconMapPin,
  IconUserOff,
} from "@tabler/icons-react";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

type MyBooking = {
  id: string;
  start: string;
  end: string;
  actualEnd: string | null;
  shootType: DbShootType;
  projectName: string | null;
  locationType: "on_site" | "office";
  propertyAddress: string | null;
  notes: string | null;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  agentName: string | null;
  agentDeclined: boolean;
  pendingCancellation: boolean;
};

const statusBadge: Record<string, { color: string; label: string } | null> = {
  confirmed: null,
  completed: { color: "green", label: "Completed" },
  cancelled: { color: "red", label: "Cancelled" },
  no_show: { color: "orange", label: "No-show" },
};

export default function MySchedule() {
  const [rows, setRows] = useState<MyBooking[] | null>(null);
  const [target, setTarget] = useState<MyBooking | null>(null);
  const [mode, setMode] = useState<"no_show" | "cancel" | "complete">("cancel");
  const [reason, setReason] = useState("");
  const [overtime, setOvertime] = useState("0");
  const [busy, setBusy] = useState(false);
  const [modalOpen, { open: openModal, close: closeModal }] =
    useDisclosure(false);

  const reload = useCallback(() => {
    fetch("/api/me/bookings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRows)
      .catch(() =>
        notifications.show({
          title: "Couldn't load your schedule",
          message: "Try refreshing.",
          color: "red",
        })
      );
  }, []);
  useEffect(reload, [reload]);

  const act = async () => {
    if (!target) return;
    setBusy(true);
    const body =
      mode === "complete"
        ? {
            action: "complete",
            ...(overtime !== "0"
              ? {
                  actualEnd: dayjs(target.end)
                    .add(Number(overtime), "minute")
                    .toISOString(),
                }
              : {}),
          }
        : { action: mode, reason };
    const res = await fetch(`/api/me/bookings/${target.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    closeModal();
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      notifications.show({
        title: "Action failed",
        message: b.error ?? "Try again.",
        color: "red",
      });
      return;
    }
    notifications.show({
      title:
        mode === "cancel"
          ? "Booking cancelled"
          : mode === "no_show"
            ? "Marked as no-show"
            : "Marked as done",
      message:
        mode === "cancel"
          ? "The event is removed and the agent has been notified."
          : mode === "no_show"
            ? "This is visible to the manager on the KPI dashboard."
            : overtime !== "0"
              ? `Recorded ${overtime} minutes of overtime.`
              : "Nice work.",
      color: mode === "cancel" ? "red" : "green",
    });
    reload();
  };

  const openAction = (b: MyBooking, m: typeof mode) => {
    setTarget(b);
    setMode(m);
    setReason("");
    setOvertime("0");
    openModal();
  };

  if (rows === null) {
    return (
      <Stack gap="md">
        <Skeleton height={32} width={160} />
        <Skeleton height={140} radius="lg" />
        <Skeleton height={140} radius="lg" />
      </Stack>
    );
  }

  const active = rows.filter(
    (b) => b.status === "confirmed" || dayjs(b.end).isAfter(dayjs().subtract(1, "day"))
  );
  const todays = active.filter((b) => dayjs(b.start).isSame(dayjs(), "day"));
  const upcoming = active.filter((b) => dayjs(b.start).isAfter(dayjs(), "day"));

  const renderBooking = (b: MyBooking, isToday: boolean) => {
    const started = dayjs(b.start).isBefore(dayjs());
    const badge = statusBadge[b.status];
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
                {dbShootTypeLabel[b.shootType]}
              </Badge>
              {badge && (
                <Badge color={badge.color} size="sm">
                  {badge.label}
                </Badge>
              )}
              {b.pendingCancellation && (
                <Badge color="yellow" size="sm">
                  Cancellation requested
                </Badge>
              )}
              {b.agentDeclined && (
                <Badge color="orange" size="sm" variant="light">
                  Agent declined invite
                </Badge>
              )}
            </Group>
          </Group>

          <Text size="sm" fw={500}>
            {b.projectName}
          </Text>
          <Text size="sm" c="dimmed">
            {b.agentName}
          </Text>

          <Group gap={6} wrap="nowrap">
            <IconMapPin size={16} color="var(--mantine-color-dimmed)" />
            {b.locationType === "on_site" && b.propertyAddress ? (
              <Anchor
                size="sm"
                href={`https://maps.google.com/?q=${encodeURIComponent(b.propertyAddress)}`}
                target="_blank"
              >
                {b.propertyAddress}
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

          {b.status === "confirmed" && (
            <>
              <Divider />
              <Group gap="xs">
                {started && (
                  <>
                    <Button
                      size="xs"
                      color="green"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => openAction(b, "complete")}
                    >
                      Mark done
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<IconUserOff size={14} />}
                      onClick={() => openAction(b, "no_show")}
                    >
                      No-show
                    </Button>
                  </>
                )}
                {!started && (
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    leftSection={<IconCalendarOff size={14} />}
                    onClick={() => openAction(b, "cancel")}
                  >
                    Cancel shoot
                  </Button>
                )}
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
        opened={modalOpen}
        onClose={closeModal}
        title={
          mode === "cancel"
            ? "Cancel this shoot"
            : mode === "no_show"
              ? "Mark as no-show"
              : "Mark as done"
        }
        centered
      >
        <Stack gap="md">
          {mode === "complete" ? (
            <>
              <Text size="sm" c="dimmed">
                Did the shoot run over the booked time?
              </Text>
              <SegmentedControl
                fullWidth
                value={overtime}
                onChange={setOvertime}
                data={[
                  { label: "On time", value: "0" },
                  { label: "+15m", value: "15" },
                  { label: "+30m", value: "30" },
                  { label: "+1h", value: "60" },
                  { label: "+2h", value: "120" },
                ]}
              />
            </>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                {mode === "cancel"
                  ? "This cancels immediately: the calendar event is removed, the agent is notified, and the manager is informed."
                  : "Use this when the agent didn't show up — it's recorded separately from cancellations."}
              </Text>
              <Textarea
                label="Reason"
                required
                autosize
                minRows={2}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
            </>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>
              Back
            </Button>
            <Button
              color={mode === "complete" ? "green" : "red"}
              disabled={mode !== "complete" && reason.trim().length < 3}
              loading={busy}
              onClick={act}
            >
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
