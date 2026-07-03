"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput, TimeInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconPlus,
} from "@tabler/icons-react";
import {
  agentById,
  bookings,
  creators,
  shootTypeLabel,
} from "@/lib/mock-data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// dayjs day(): 0=Sun … 6=Sat; our row order starts Monday.
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

type DayHours = { on: boolean; from: string; to: string };

function defaultHours(id: string): DayHours[] {
  const c = creators.find((x) => x.id === id)!;
  return DAY_INDEX.map((d) => ({
    on: c.settings.workDays.includes(d),
    from: "09:00",
    to: "17:00",
  }));
}

function defaultDurations(id: string) {
  const s = creators.find((x) => x.id === id)!.settings;
  return {
    photo: s.photoDuration,
    video: s.videoDuration,
    buffer: s.buffer,
    notice: s.minNoticeHours,
    horizon: s.horizonWeeks,
    maxPerDay: s.maxShootsPerDay,
  };
}

// Screen 13 — Creator settings & time off. Creators never see this screen;
// it shapes everything the booking page offers.
export default function CreatorSettings() {
  const [creatorId, setCreatorId] = useState(creators[0].id);
  const creator = creators.find((c) => c.id === creatorId)!;

  const [hours, setHours] = useState<DayHours[]>(() => defaultHours(creators[0].id));
  const [lunch, setLunch] = useState({ on: true, from: "12:30", to: "13:00" });
  const [durations, setDurations] = useState(() => defaultDurations(creators[0].id));
  const [timeOff, setTimeOff] = useState(creators[0].timeOff);
  const [leaveRange, setLeaveRange] = useState<[string | null, string | null]>([null, null]);
  const [leaveReason, setLeaveReason] = useState("");
  const [handled, setHandled] = useState<string[]>([]);

  const switchCreator = (id: string | null) => {
    if (!id) return;
    setCreatorId(id);
    setHours(defaultHours(id));
    setDurations(defaultDurations(id));
    setTimeOff(creators.find((c) => c.id === id)!.timeOff);
    setLeaveRange([null, null]);
    setLeaveReason("");
    setHandled([]);
  };

  // Confirmed bookings inside the drafted leave range — each must be
  // reassigned or cancelled before the leave takes effect.
  const conflicts = useMemo(() => {
    const [from, to] = leaveRange;
    if (!from || !to) return [];
    return bookings.filter(
      (b) =>
        b.creatorId === creatorId &&
        b.status === "confirmed" &&
        dayjs(b.start).format("YYYY-MM-DD") >= from &&
        dayjs(b.start).format("YYYY-MM-DD") <= to
    );
  }, [creatorId, leaveRange]);

  const unresolved = conflicts.filter((b) => !handled.includes(b.id));

  const addLeave = () => {
    const [from, to] = leaveRange;
    if (!from || !to) return;
    setTimeOff((t) => [...t, { from, to, reason: leaveReason || "Time off" }]);
    setLeaveRange([null, null]);
    setLeaveReason("");
    setHandled([]);
    notifications.show({
      title: "Time off added",
      message: `${creator.name} is hidden from the booking page for that period.`,
      color: "green",
    });
  };

  const resolve = (id: string, how: "reassign" | "cancel") => {
    setHandled((h) => [...h, id]);
    notifications.show({
      title: how === "reassign" ? "Booking reassigned" : "Booking cancelled",
      message: "Agent notified automatically.",
      color: how === "reassign" ? "green" : "red",
    });
  };

  const save = () =>
    notifications.show({
      title: "Settings saved",
      message: `Bookable slots for ${creator.name} update immediately.`,
      color: "green",
    });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Creator settings &amp; time off</Title>
          <Text size="sm" c="dimmed">
            Shapes the bookable slots — creators never see or edit this.
          </Text>
        </div>
        <Select
          data={creators.map((c) => ({
            value: c.id,
            label: c.active ? c.name : `${c.name} (deactivated)`,
          }))}
          value={creatorId}
          onChange={switchCreator}
          allowDeselect={false}
          maw={220}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <Text fw={600}>Working hours</Text>
            <Table verticalSpacing={6}>
              <Table.Tbody>
                {WEEKDAYS.map((label, i) => (
                  <Table.Tr key={label}>
                    <Table.Td w={90}>
                      <Switch
                        label={label}
                        checked={hours[i].on}
                        onChange={(e) =>
                          setHours((h) =>
                            h.map((x, j) =>
                              j === i ? { ...x, on: e.currentTarget.checked } : x
                            )
                          )
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <TimeInput
                          size="xs"
                          value={hours[i].from}
                          disabled={!hours[i].on}
                          onChange={(e) =>
                            setHours((h) =>
                              h.map((x, j) =>
                                j === i ? { ...x, from: e.currentTarget.value } : x
                              )
                            )
                          }
                        />
                        <Text size="xs" c="dimmed">
                          to
                        </Text>
                        <TimeInput
                          size="xs"
                          value={hours[i].to}
                          disabled={!hours[i].on}
                          onChange={(e) =>
                            setHours((h) =>
                              h.map((x, j) =>
                                j === i ? { ...x, to: e.currentTarget.value } : x
                              )
                            )
                          }
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Divider />
            <Group gap="sm">
              <Switch
                label="Lunch split"
                checked={lunch.on}
                onChange={(e) => setLunch({ ...lunch, on: e.currentTarget.checked })}
              />
              <TimeInput
                size="xs"
                value={lunch.from}
                disabled={!lunch.on}
                onChange={(e) => setLunch({ ...lunch, from: e.currentTarget.value })}
              />
              <Text size="xs" c="dimmed">
                to
              </Text>
              <TimeInput
                size="xs"
                value={lunch.to}
                disabled={!lunch.on}
                onChange={(e) => setLunch({ ...lunch, to: e.currentTarget.value })}
              />
            </Group>
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Text fw={600}>Booking rules</Text>
            <SimpleGrid cols={2} spacing="sm">
              <NumberInput
                label="Photo shoot (min)"
                value={durations.photo}
                onChange={(v) => setDurations({ ...durations, photo: Number(v) || 0 })}
                min={15}
                step={15}
              />
              <NumberInput
                label="Video shoot (min)"
                value={durations.video}
                onChange={(v) => setDurations({ ...durations, video: Number(v) || 0 })}
                min={15}
                step={15}
              />
              <NumberInput
                label="Buffer between shoots (min)"
                value={durations.buffer}
                onChange={(v) => setDurations({ ...durations, buffer: Number(v) || 0 })}
                min={0}
                step={15}
              />
              <NumberInput
                label="Minimum notice (hours)"
                value={durations.notice}
                onChange={(v) => setDurations({ ...durations, notice: Number(v) || 0 })}
                min={0}
              />
              <NumberInput
                label="Booking horizon (weeks)"
                value={durations.horizon}
                onChange={(v) => setDurations({ ...durations, horizon: Number(v) || 0 })}
                min={1}
              />
              <NumberInput
                label="Max shoots per day"
                value={durations.maxPerDay}
                onChange={(v) => setDurations({ ...durations, maxPerDay: Number(v) || 0 })}
                min={1}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save}>
                Save settings
              </Button>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card>
        <Stack gap="sm">
          <Text fw={600}>Time off</Text>

          {timeOff.length > 0 ? (
            <Stack gap={6}>
              {timeOff.map((t, i) => (
                <Group key={i} gap="sm">
                  <Badge variant="light" color="gray">
                    {dayjs(t.from).format("D MMM")} – {dayjs(t.to).format("D MMM")}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {t.reason}
                  </Text>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No time off scheduled.
            </Text>
          )}

          <Divider label="Add leave" />
          <Group align="flex-end" wrap="wrap">
            <DatePickerInput
              type="range"
              label="Leave period"
              placeholder="Pick a date range"
              value={leaveRange}
              onChange={setLeaveRange}
              miw={220}
            />
            <TextInput
              label="Reason"
              placeholder="Vacation, training…"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.currentTarget.value)}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              disabled={!leaveRange[0] || !leaveRange[1] || unresolved.length > 0}
              onClick={addLeave}
            >
              Add time off
            </Button>
          </Group>

          {conflicts.length > 0 && (
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={18} />}
              title={`${conflicts.length} confirmed booking${conflicts.length > 1 ? "s" : ""} inside this range`}
            >
              <Stack gap="xs">
                <Text size="sm">
                  Each one must be reassigned or cancelled before the leave is
                  saved — agents are notified automatically.
                </Text>
                {conflicts.map((b) => {
                  const done = handled.includes(b.id);
                  return (
                    <Group key={b.id} justify="space-between" wrap="nowrap">
                      <Text size="sm" td={done ? "line-through" : undefined}>
                        {dayjs(b.start).format("ddd D MMM HH:mm")} ·{" "}
                        {shootTypeLabel[b.shootType]} ·{" "}
                        {agentById(b.agentId)?.name}
                      </Text>
                      {done ? (
                        <Badge size="sm" color="green" variant="light">
                          Handled
                        </Badge>
                      ) : (
                        <Group gap={6}>
                          <Button
                            size="compact-xs"
                            variant="default"
                            onClick={() => resolve(b.id, "reassign")}
                          >
                            Reassign
                          </Button>
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="red"
                            onClick={() => resolve(b.id, "cancel")}
                          >
                            Cancel
                          </Button>
                        </Group>
                      )}
                    </Group>
                  );
                })}
              </Stack>
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
