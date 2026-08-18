"use client";

// Screen 12 — Bookings overview on real data: week grid, cancel/edit/move,
// pending ≤24h cancellation requests (§B12.1), decline flags.

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Card,
  Divider,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  NumberInput,
  Table,
  Text,
  TextInput,
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
  IconPlus,
} from "@tabler/icons-react";
import { DatePickerInput, TimeInput, DateTimePicker } from "@mantine/dates";
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
  notes: string | null;
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
  const [noShowReason, setNoShowReason] = useState("");
  // Restoring re-creates the calendar event; whether that mails the agent is a
  // per-case call, so the manager chooses rather than us guessing.
  const [notifyAgent, setNotifyAgent] = useState(true);
  const [edit, setEdit] = useState({
    projectName: "",
    propertyAddress: "",
    notes: "",
    locationType: "on_site" as "on_site" | "office",
    shootType: "video" as "photo" | "video" | "photo_video",
  });
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [moveMinutes, setMoveMinutes] = useState<number | string>(120);
  const [busy, setBusy] = useState(false);
  const [detailOpen, { open: openDetail, close: closeDetail }] =
    useDisclosure(false);
  const [companyOpen, { open: openCompany, close: closeCompany }] =
    useDisclosure(false);
  const [draft, setDraft] = useState({
    creatorId: null as string | null,
    day: null as string | null,
    time: "10:00",
    duration: 120,
    type: "photo_video" as DbShootType,
    project: "",
    notes: "",
  });

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

  const act = async (
    action:
      | "cancel"
      | "no_show"
      | "undo_no_show"
      | "undo_cancel"
      | "edit"
      | "reschedule"
  ) => {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/admin/bookings/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "edit"
          ? { action, ...edit }
          : action === "reschedule"
            ? {
                action,
                start: dayjs(moveTo).toISOString(),
                durationMinutes: Number(moveMinutes) || 120,
              }
          : action === "undo_no_show"
            ? { action }
            : action === "undo_cancel"
              ? { action, notifyAgent }
              : { action, reason: action === "no_show" ? noShowReason : reason }
      ),
    });
    setBusy(false);
    closeDetail();
    const body = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? {
            title:
              action === "cancel"
                ? "Booking cancelled"
                : action === "no_show"
                  ? "Marked as a no-show"
                  : action === "undo_no_show"
                    ? "No-show reversed"
                    : action === "undo_cancel"
                      ? "Booking restored"
                      : action === "edit"
                        ? "Details updated"
                        : action === "reschedule"
                          ? "Booking moved"
                          : "Done",
            message:
              action === "cancel"
                ? "Calendar event removed — agent notified."
                : action === "no_show"
                  ? "It no longer counts as a completed shoot."
                  : action === "undo_no_show"
                    ? "It counts as a completed shoot again."
                    : action === "undo_cancel"
                      ? notifyAgent
                        ? "Back on the calendar — agent re-invited."
                        : "Back on the calendar, quietly."
                      : "New invite sent; old event removed.",
            color:
              action === "cancel"
                ? "red"
                : action === "no_show"
                  ? "orange"
                  : "green",
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
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setDraft({
                creatorId: null,
                day: weekStart.format("YYYY-MM-DD"),
                time: "10:00",
                duration: 120,
                type: "photo_video",
                project: "",
                notes: "",
              });
              openCompany();
            }}
          >
            Company shoot
          </Button>
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
                                setNoShowReason("");
                                setNotifyAgent(
                                  dayjs(b.start).isAfter(dayjs())
                                );
                                setEdit({
                                  projectName: b.projectName ?? "",
                                  propertyAddress: b.propertyAddress ?? "",
                                  notes: b.notes ?? "",
                                  locationType: b.locationType,
                                  shootType: b.shootType,
                                });
                                setMoveTo(b.start);
                                setMoveMinutes(
                                  dayjs(b.end).diff(dayjs(b.start), "minute")
                                );
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

      <Modal opened={companyOpen} onClose={closeCompany} title="New company shoot" centered>
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Manager-only: no agent, free-form time — overlaps are still blocked.
          </Text>
          <Select
            label="Creator"
            required
            data={creators.map((c) => ({ value: c.id, label: c.name }))}
            value={draft.creatorId}
            onChange={(v) => setDraft({ ...draft, creatorId: v })}
          />
          <TextInput
            label="Project name"
            required
            placeholder="What is the shoot about?"
            value={draft.project}
            onChange={(e) => setDraft({ ...draft, project: e.currentTarget.value })}
          />
          <Group grow>
            <DatePickerInput
              label="Day"
              value={draft.day}
              onChange={(v) => setDraft({ ...draft, day: v })}
              minDate={dayjs().format("YYYY-MM-DD")}
            />
            <TimeInput
              label="Start"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.currentTarget.value })}
            />
            <NumberInput
              label="Duration (min)"
              value={draft.duration}
              onChange={(v) => setDraft({ ...draft, duration: Number(v) || 60 })}
              min={15}
              step={15}
            />
          </Group>
          <Select
            label="Shoot type"
            data={(Object.keys(dbShootTypeLabel) as DbShootType[]).map((t) => ({
              value: t,
              label: dbShootTypeLabel[t],
            }))}
            value={draft.type}
            onChange={(v) => setDraft({ ...draft, type: (v ?? "photo_video") as DbShootType })}
          />
          <Textarea
            label="Notes"
            autosize
            minRows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCompany}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={!draft.creatorId || !draft.day || draft.project.trim() === ""}
              onClick={async () => {
                setBusy(true);
                const [h, m] = draft.time.split(":").map(Number);
                const res = await fetch("/api/admin/company-bookings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    creatorId: draft.creatorId,
                    shootType: draft.type,
                    start: dayjs(draft.day).hour(h).minute(m).toISOString(),
                    durationMinutes: draft.duration,
                    projectName: draft.project,
                    locationType: "office",
                    notes: draft.notes.trim() || undefined,
                  }),
                });
                setBusy(false);
                const body = await res.json().catch(() => ({}));
                notifications.show(
                  res.ok
                    ? {
                        title: "Company shoot booked",
                        message: "It's on the creator's calendar.",
                        color: "green",
                      }
                    : { title: "Couldn't book", message: body.error ?? "Try again.", color: "red" }
                );
                if (res.ok) {
                  closeCompany();
                  reload();
                }
              }}
            >
              Book company shoot
            </Button>
          </Group>
        </Stack>
      </Modal>

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

            {/* Details were captured once on the agent's form; this is the
                only place they can be corrected. */}
            {(selected.status === "confirmed" ||
              selected.status === "completed") && (
              <>
                <Divider label="Correct the details" />
                <TextInput
                  label="Project"
                  value={edit.projectName}
                  onChange={(e) =>
                    setEdit({ ...edit, projectName: e.currentTarget.value })
                  }
                />
                <Group grow>
                  <Select
                    label="Type"
                    data={[
                      { value: "photo", label: "Photo" },
                      { value: "video", label: "Video" },
                      { value: "photo_video", label: "Photo + Video" },
                    ]}
                    value={edit.shootType}
                    onChange={(v) =>
                      setEdit({ ...edit, shootType: (v as typeof edit.shootType) ?? edit.shootType })
                    }
                    allowDeselect={false}
                  />
                  <Select
                    label="Location"
                    data={[
                      { value: "on_site", label: "On site" },
                      { value: "office", label: "Office" },
                    ]}
                    value={edit.locationType}
                    onChange={(v) =>
                      setEdit({ ...edit, locationType: (v as typeof edit.locationType) ?? edit.locationType })
                    }
                    allowDeselect={false}
                  />
                </Group>
                {edit.locationType === "on_site" && (
                  <TextInput
                    label="Address"
                    value={edit.propertyAddress}
                    onChange={(e) =>
                      setEdit({ ...edit, propertyAddress: e.currentTarget.value })
                    }
                  />
                )}
                <Textarea
                  label="Notes"
                  autosize
                  minRows={2}
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.currentTarget.value })}
                />
                <Button
                  variant="light"
                  loading={busy}
                  disabled={edit.projectName.trim() === ""}
                  onClick={() => act("edit")}
                >
                  Save details
                </Button>
              </>
            )}

            {selected.status === "confirmed" && (
              <>
                <Divider label="Move it" />
                <Text size="xs" c="dimmed">
                  The agent is notified and their calendar event moves with it.
                </Text>
                <Group grow align="flex-end">
                  <DateTimePicker
                    label="New start"
                    valueFormat="ddd D MMM, HH:mm"
                    value={moveTo}
                    onChange={setMoveTo}
                  />
                  <NumberInput
                    label="Minutes"
                    min={15}
                    max={720}
                    step={15}
                    value={moveMinutes}
                    onChange={setMoveMinutes}
                  />
                </Group>
                <Button
                  variant="light"
                  loading={busy}
                  disabled={!moveTo}
                  onClick={() => act("reschedule")}
                >
                  Move booking
                </Button>
              </>
            )}

            {selected.status === "cancelled" && (
              <>
                <Divider label="Cancelled in error?" />
                <Text size="xs" c="dimmed">
                  Puts it back on {selected.creatorName}&apos;s calendar. If the
                  slot has since been taken, this will say so rather than
                  double-booking.
                </Text>
                <Checkbox
                  checked={notifyAgent}
                  onChange={(e) => setNotifyAgent(e.currentTarget.checked)}
                  label={`Send ${selected.agentName ?? "the agent"} a new invite`}
                />
                <Button
                  variant="light"
                  loading={busy}
                  onClick={() => act("undo_cancel")}
                >
                  Restore booking
                </Button>
              </>
            )}

            {selected.status === "no_show" && (
              <>
                <Divider label="Marked in error?" />
                <Button
                  variant="light"
                  loading={busy}
                  onClick={() => act("undo_no_show")}
                >
                  Undo no-show
                </Button>
              </>
            )}

            {(selected.status === "confirmed" ||
              selected.status === "completed") &&
              dayjs(selected.start).isBefore(dayjs()) && (
                <>
                  <Divider label="Agent didn't turn up" />
                  <Textarea
                    placeholder="What happened? (required)"
                    autosize
                    minRows={2}
                    value={noShowReason}
                    onChange={(e) => setNoShowReason(e.currentTarget.value)}
                  />
                  <Button
                    color="orange"
                    variant="light"
                    disabled={noShowReason.trim().length < 3}
                    loading={busy}
                    onClick={() => act("no_show")}
                  >
                    Mark as no-show
                  </Button>
                </>
              )}

            {selected.status === "confirmed" && (
              <>

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
