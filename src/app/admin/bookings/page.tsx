"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Select,
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
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "@tabler/icons-react";
import { TimeInput } from "@mantine/dates";
import {
  agentById,
  agents,
  bookings as initialBookings,
  creators,
  shootTypeLabel,
  type Booking,
  type BookingStatus,
  type ShootType,
} from "@/lib/mock-data";

const statusColor: Record<BookingStatus, string> = {
  confirmed: "brand",
  completed: "gray",
  cancelled: "red",
  no_show: "orange",
  pending_cancellation: "yellow",
};

const activeCreators = creators.filter((c) => c.active);

// Screen 12 — Bookings overview: every creator's week on one screen.
export default function BookingsOverview() {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [weekStart, setWeekStart] = useState(() =>
    dayjs().startOf("week").add(1, "day")
  ); // Monday
  const [selected, setSelected] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const [detailOpen, { open: openDetail, close: closeDetail }] =
    useDisclosure(false);
  const [createOpen, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [draft, setDraft] = useState({
    creatorId: null as string | null,
    agentId: null as string | null,
    day: null as string | null,
    time: "10:00",
    type: "photo" as ShootType,
  });

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));

  const cellBookings = (creatorId: string, day: dayjs.Dayjs) =>
    bookings
      .filter(
        (b) =>
          b.creatorId === creatorId && dayjs(b.start).isSame(day, "day")
      )
      .sort((a, b) => a.start.localeCompare(b.start));

  const pick = (b: Booking) => {
    setSelected(b);
    setReason("");
    setReassignTo(null);
    openDetail();
  };

  const cancelBooking = () => {
    if (!selected) return;
    setBookings((all) =>
      all.map((b) =>
        b.id === selected.id
          ? { ...b, status: "cancelled" as const, cancellationReason: reason }
          : b
      )
    );
    notifications.show({
      title: "Booking cancelled",
      message: "Calendar event removed — agent and creator notified.",
      color: "red",
    });
    closeDetail();
  };

  const reassign = () => {
    if (!selected || !reassignTo) return;
    setBookings((all) =>
      all.map((b) =>
        b.id === selected.id ? { ...b, creatorId: reassignTo } : b
      )
    );
    notifications.show({
      title: "Booking reassigned",
      message: `Moved to ${creators.find((c) => c.id === reassignTo)?.name} — everyone notified.`,
      color: "green",
    });
    closeDetail();
  };

  const createBooking = () => {
    const { creatorId, agentId, day, time, type } = draft;
    if (!creatorId || !agentId || !day) return;
    const [h, m] = time.split(":").map(Number);
    const start = dayjs(day).hour(h).minute(m);
    const creator = creators.find((c) => c.id === creatorId)!;
    const duration =
      type === "video"
        ? creator.settings.videoDuration
        : creator.settings.photoDuration;
    setBookings((all) => [
      ...all,
      {
        id: `new-${all.length}`,
        creatorId,
        agentId,
        start: start.toISOString(),
        end: start.add(duration, "minute").toISOString(),
        shootType: type,
        location: { kind: "office" },
        status: "confirmed",
      },
    ]);
    notifications.show({
      title: "Booking created",
      message: "Calendar invites sent to creator and agent.",
      color: "green",
    });
    closeCreate();
  };

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
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setDraft({
                creatorId: null,
                agentId: null,
                day: weekStart.format("YYYY-MM-DD"),
                time: "10:00",
                type: "photo",
              });
              openCreate();
            }}
          >
            New booking
          </Button>
        </Group>
      </Group>

      <Card padding="xs">
        <Table.ScrollContainer minWidth={860}>
          <Table verticalSpacing="xs" withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={130}>Creator</Table.Th>
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
              {activeCreators.map((c) => (
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
                          <UnstyledButton key={b.id} onClick={() => pick(b)}>
                            <Badge
                              variant="light"
                              color={statusColor[b.status]}
                              size="sm"
                              fullWidth
                              radius="sm"
                              style={{
                                textDecoration:
                                  b.status === "cancelled"
                                    ? "line-through"
                                    : undefined,
                              }}
                            >
                              {dayjs(b.start).format("HH:mm")}{" "}
                              {agentById(b.agentId)?.name.split(" ").pop()}
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

      <Group gap="md">
        {(
          [
            ["confirmed", "Confirmed"],
            ["pending_cancellation", "Cancellation requested"],
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
      </Group>

      <Modal
        opened={detailOpen}
        onClose={closeDetail}
        title="Booking details"
        centered
      >
        {selected && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>
                {dayjs(selected.start).format("ddd D MMM, HH:mm")}–
                {dayjs(selected.end).format("HH:mm")}
              </Text>
              <Badge variant="light" color={statusColor[selected.status]}>
                {selected.status.replace("_", " ")}
              </Badge>
            </Group>
            <Text size="sm">
              {creators.find((c) => c.id === selected.creatorId)?.name} ·{" "}
              {shootTypeLabel[selected.shootType]} ·{" "}
              {selected.location.kind === "onsite"
                ? selected.location.address
                : "Office"}
            </Text>
            <Text size="sm" c="dimmed">
              Booked by {agentById(selected.agentId)?.name}
            </Text>
            {selected.cancellationReason && (
              <Text size="sm" c="dimmed">
                Reason: “{selected.cancellationReason}”
              </Text>
            )}

            {["confirmed", "pending_cancellation"].includes(
              selected.status
            ) && (
              <>
                <Divider label="Reassign (e.g. creator is sick)" />
                <Group>
                  <Select
                    placeholder="Move to…"
                    data={activeCreators
                      .filter((c) => c.id !== selected.creatorId)
                      .map((c) => ({ value: c.id, label: c.name }))}
                    value={reassignTo}
                    onChange={setReassignTo}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="default"
                    disabled={!reassignTo}
                    onClick={reassign}
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
                  disabled={reason.trim() === ""}
                  onClick={cancelBooking}
                >
                  Cancel booking
                </Button>
              </>
            )}
          </Stack>
        )}
      </Modal>

      <Modal
        opened={createOpen}
        onClose={closeCreate}
        title="New booking"
        centered
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            For manual entries like company shoots — bypasses agent booking.
          </Text>
          <Select
            label="Creator"
            required
            data={activeCreators.map((c) => ({ value: c.id, label: c.name }))}
            value={draft.creatorId}
            onChange={(v) => setDraft({ ...draft, creatorId: v })}
          />
          <Select
            label="Agent / requester"
            required
            searchable
            data={agents
              .filter((a) => a.status === "active")
              .map((a) => ({ value: a.id, label: `${a.name} — ${a.office}` }))}
            value={draft.agentId}
            onChange={(v) => setDraft({ ...draft, agentId: v })}
          />
          <Group grow>
            <Select
              label="Day"
              data={days.map((d) => ({
                value: d.format("YYYY-MM-DD"),
                label: d.format("ddd D MMM"),
              }))}
              value={draft.day}
              onChange={(v) => setDraft({ ...draft, day: v })}
            />
            <TimeInput
              label="Start"
              value={draft.time}
              onChange={(e) =>
                setDraft({ ...draft, time: e.currentTarget.value })
              }
            />
          </Group>
          <Select
            label="Shoot type"
            data={(["photo", "video", "both"] as const).map((t) => ({
              value: t,
              label: shootTypeLabel[t],
            }))}
            value={draft.type}
            onChange={(v) => setDraft({ ...draft, type: (v ?? "photo") as ShootType })}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              disabled={!draft.creatorId || !draft.agentId || !draft.day}
              onClick={createBooking}
            >
              Create booking
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
