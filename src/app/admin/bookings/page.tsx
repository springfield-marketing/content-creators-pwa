"use client";

// Screen 12 — Bookings overview on real data: week grid, cancel/reassign,
// pending ≤24h cancellation requests (§B12.1), decline flags.

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

type AdminBooking = {
  id: string;
  creatorId: string;
  creatorName: string;
  agentName: string | null;
  start: string;
  end: string;
  shootType: DbShootType;
  projectName: string | null;
  locationType: "on_site" | "office";
  propertyAddress: string | null;
  status: string;
  cancellationReason: string | null;
  cancelledBy: string | null;
  agentDeclined: boolean;
};

type CancelRequest = {
  id: string;
  reason: string;
  bookingId: string;
  start: string;
  projectName: string | null;
  creatorName: string;
  agentName: string | null;
};

const statusColor: Record<string, string> = {
  confirmed: "brand",
  completed: "gray",
  cancelled: "red",
  no_show: "orange",
};

export default function BookingsOverview() {
  const [weekStart, setWeekStart] = useState(() =>
    dayjs().startOf("week").add(1, "day")
  );
  const [rows, setRows] = useState<AdminBooking[] | null>(null);
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);
  const [requests, setRequests] = useState<CancelRequest[]>([]);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [reason, setReason] = useState("");
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailOpen, { open: openDetail, close: closeDetail }] =
    useDisclosure(false);

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));

  const reload = useCallback(() => {
    const from = weekStart.format("YYYY-MM-DD");
    const to = weekStart.add(6, "day").format("YYYY-MM-DD");
    fetch(`/api/admin/bookings?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRows)
      .catch(() => setRows([]));
    fetch("/api/admin/cancellation-requests")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRequests)
      .catch(() => {});
    fetch("/api/admin/creators")
      .then((r) => (r.ok ? r.json() : []))
      .then((cs: { id: string; name: string; isActive: boolean }[]) =>
        setCreators(cs.filter((c) => c.isActive))
      )
      .catch(() => {});
  }, [weekStart]);
  useEffect(reload, [reload]);

  const decideRequest = async (id: string, approve: boolean) => {
    const res = await fetch("/api/admin/cancellation-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approve }),
    });
    if (res.ok) {
      notifications.show({
        title: approve ? "Cancellation approved" : "Request declined",
        message: approve
          ? "The event is removed and the agent notified."
          : "The booking stands — the agent will be told.",
        color: approve ? "red" : "blue",
      });
      reload();
    }
  };

  const act = async (action: "cancel" | "reassign") => {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/admin/bookings/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "cancel"
          ? { action, reason }
          : { action, creatorId: reassignTo }
      ),
    });
    setBusy(false);
    closeDetail();
    const body = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? {
            title: action === "cancel" ? "Booking cancelled" : "Booking reassigned",
            message:
              action === "cancel"
                ? "Calendar event removed — agent notified."
                : "New invite sent; old event removed.",
            color: action === "cancel" ? "red" : "green",
          }
        : { title: "Action failed", message: body.error ?? "Try again.", color: "red" }
    );
    reload();
  };

  const cellBookings = (creatorId: string, day: dayjs.Dayjs) =>
    (rows ?? [])
      .filter((b) => b.creatorId === creatorId && dayjs(b.start).isSame(day, "day"))
      .sort((a, b) => a.start.localeCompare(b.start));

  const gridCreators = creators.length
    ? creators
    : [...new Map((rows ?? []).map((b) => [b.creatorId, { id: b.creatorId, name: b.creatorName }])).values()];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Bookings overview</Title>
          <Text size="sm" c="dimmed">
            All creators · week of {weekStart.format("D MMM")}
          </Text>
        </div>
        <Group gap="xs">
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => setWeekStart((w) => w.subtract(1, "week"))}
            aria-label="Previous week"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Button
            variant="default"
            onClick={() => setWeekStart(dayjs().startOf("week").add(1, "day"))}
          >
            This week
          </Button>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => setWeekStart((w) => w.add(1, "week"))}
            aria-label="Next week"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {requests.length > 0 && (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconAlertTriangle size={18} />}
          title={`${requests.length} late cancellation request${requests.length > 1 ? "s" : ""} waiting`}
        >
          <Stack gap="xs">
            {requests.map((r) => (
              <Group key={r.id} justify="space-between" wrap="nowrap">
                <Text size="sm">
                  {dayjs(r.start).format("ddd D MMM HH:mm")} · {r.projectName} ·{" "}
                  {r.creatorName} — “{r.reason}” ({r.agentName})
                </Text>
                <Group gap={6}>
                  <Button size="compact-xs" color="red" onClick={() => decideRequest(r.id, true)}>
                    Approve
                  </Button>
                  <Button size="compact-xs" variant="default" onClick={() => decideRequest(r.id, false)}>
                    Decline
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {rows === null ? (
        <Skeleton height={320} radius="lg" />
      ) : (
        <Card padding="xs">
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="xs" withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={140}>Creator</Table.Th>
                  {days.map((d) => (
                    <Table.Th
                      key={d.format()}
                      ta="center"
                      c={d.isSame(dayjs(), "day") ? "brand" : undefined}
                    >
                      {d.format("ddd D")}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {gridCreators.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {c.name}
                      </Text>
                    </Table.Td>
                    {days.map((d) => (
                      <Table.Td key={d.format()} p={4} valign="top">
                        <Stack gap={4}>
                          {cellBookings(c.id, d).map((b) => (
                            <UnstyledButton
                              key={b.id}
                              onClick={() => {
                                setSelected(b);
                                setReason("");
                                setReassignTo(null);
                                openDetail();
                              }}
                            >
                              <Badge
                                variant="light"
                                color={
                                  b.agentDeclined
                                    ? "orange"
                                    : (statusColor[b.status] ?? "gray")
                                }
                                size="sm"
                                fullWidth
                                radius="sm"
                                style={{
                                  textDecoration:
                                    b.status === "cancelled" ? "line-through" : undefined,
                                }}
                              >
                                {dayjs(b.start).format("HH:mm")}{" "}
                                {(b.agentName ?? "—").split(" ")[0]}
                              </Badge>
                            </UnstyledButton>
                          ))}
                        </Stack>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Group gap="md">
        {(
          [
            ["confirmed", "Confirmed"],
            ["completed", "Completed"],
            ["no_show", "No-show"],
            ["cancelled", "Cancelled"],
          ] as const
        ).map(([s, label]) => (
          <Group key={s} gap={6}>
            <Badge variant="light" color={statusColor[s]} size="xs" circle />
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          </Group>
        ))}
        <Group gap={6}>
          <Badge variant="light" color="orange" size="xs" circle />
          <Text size="xs" c="dimmed">
            Agent declined invite
          </Text>
        </Group>
      </Group>

      <Modal opened={detailOpen} onClose={closeDetail} title="Booking details" centered>
        {selected && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>
                {dayjs(selected.start).format("ddd D MMM, HH:mm")}–
                {dayjs(selected.end).format("HH:mm")}
              </Text>
              <Badge variant="light" color={statusColor[selected.status] ?? "gray"}>
                {selected.status.replace("_", " ")}
              </Badge>
            </Group>
            <Text size="sm" fw={500}>
              {selected.projectName}
            </Text>
            <Text size="sm">
              {selected.creatorName} · {dbShootTypeLabel[selected.shootType]} ·{" "}
              {selected.locationType === "on_site"
                ? selected.propertyAddress
                : "Office"}
            </Text>
            <Text size="sm" c="dimmed">
              Booked by {selected.agentName}
            </Text>
            {selected.agentDeclined && (
              <Alert color="orange" variant="light" p="xs">
                The agent declined the calendar invite — worth a follow-up call.
              </Alert>
            )}
            {selected.cancellationReason && (
              <Text size="sm" c="dimmed">
                Reason: “{selected.cancellationReason}”
                {selected.cancelledBy ? ` (${selected.cancelledBy})` : ""}
              </Text>
            )}

            {selected.status === "confirmed" && (
              <>
                <Divider label="Reassign (e.g. creator is sick)" />
                <Group>
                  <Select
                    placeholder="Move to…"
                    data={creators
                      .filter((c) => c.id !== selected.creatorId)
                      .map((c) => ({ value: c.id, label: c.name }))}
                    value={reassignTo}
                    onChange={setReassignTo}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="default"
                    disabled={!reassignTo}
                    loading={busy}
                    onClick={() => act("reassign")}
                  >
                    Reassign
                  </Button>
                </Group>

                <Divider label="Cancel booking" />
                <Textarea
                  placeholder="Cancellation reason (required)"
                  autosize
                  minRows={2}
                  value={reason}
                  onChange={(e) => setReason(e.currentTarget.value)}
                />
                <Button
                  color="red"
                  variant="light"
                  disabled={reason.trim().length < 3}
                  loading={busy}
                  onClick={() => act("cancel")}
                >
                  Cancel booking
                </Button>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
