"use client";

// Weekly plan: per creator, per week — open/closed, role for the week
// (all / photo only / video only / company only), and optional custom hours.
// STRICT: weeks without a plan are not bookable at all.

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { WeekHoursEditor, type Hours } from "@/components/WeekHoursEditor";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

type PlanRow = {
  creatorId: string;
  creatorName: string;
  planned: boolean;
  role: "all" | "photo_only" | "video_only" | "company_only";
  workingHours: Hours | null;
  defaultHours: Hours;
};
type Conflict = {
  id: string;
  creatorId: string;
  start: string;
  shootType: DbShootType;
  projectName: string | null;
  agentName: string | null;
};

const mondayOf = (d: dayjs.Dayjs) => d.subtract((d.day() + 6) % 7, "day");

export default function WeeklyPlan() {
  const [week, setWeek] = useState(() =>
    mondayOf(dayjs()).format("YYYY-MM-DD")
  );
  const [result, setResult] = useState<{ key: string; rows: PlanRow[] } | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/week-plan?week=${week}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setResult({ key: week, rows: d.rows }))
      .catch(() => !cancelled && setResult({ key: week, rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [week]);

  const rows = result?.key === week ? result.rows : null;
  const setRows = (fn: (r: PlanRow[]) => PlanRow[]) =>
    setResult((cur) => (cur ? { ...cur, rows: fn(cur.rows) } : cur));

  const updateRow = (id: string, patch: Partial<PlanRow>) =>
    setRows((r) =>
      r.map((row) => (row.creatorId === id ? { ...row, ...patch } : row))
    );

  const copyPreviousWeek = async () => {
    const prev = dayjs(week).subtract(7, "day").format("YYYY-MM-DD");
    const res = await fetch(`/api/admin/week-plan?week=${prev}`);
    if (!res.ok) return;
    const d = await res.json();
    const byId = new Map((d.rows as PlanRow[]).map((r) => [r.creatorId, r]));
    setRows((cur) =>
      cur.map((r) => {
        const p = byId.get(r.creatorId);
        return p
          ? { ...r, planned: p.planned, role: p.role, workingHours: p.workingHours }
          : r;
      })
    );
    notifications.show({
      title: `Copied from week of ${dayjs(prev).format("D MMM")}`,
      message: "Adjust and save.",
      color: "blue",
    });
  };

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    const res = await fetch("/api/admin/week-plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week,
        rows: rows.map(({ creatorId, planned, role, workingHours }) => ({
          creatorId,
          planned,
          role,
          workingHours,
        })),
      }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      setConflicts(body.conflicts ?? []);
      notifications.show({
        title: "Existing bookings conflict with the new roles",
        message: body.error,
        color: "orange",
      });
      return;
    }
    setConflicts([]);
    notifications.show(
      res.ok
        ? {
            title: "Week plan saved",
            message: `Booking calendars for the week of ${dayjs(week).format("D MMM")} are live.`,
            color: "green",
          }
        : { title: "Save failed", message: body.error ?? "Try again.", color: "red" }
    );
  };

  const resolveConflict = async (bookingId: string, how: "cancel") => {
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: how,
        reason: "Creator role changed for the week",
      }),
    });
    if (res.ok) {
      setConflicts((c) => c.filter((x) => x.id !== bookingId));
      notifications.show({
        title: "Booking cancelled",
        message: "Agent notified — save the plan again.",
        color: "red",
      });
    }
  };

  const weekLabel = `${dayjs(week).format("D MMM")} – ${dayjs(week).add(6, "day").format("D MMM YYYY")}`;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Weekly plan</Title>
          <Text size="sm" c="dimmed">
            Agents can only book weeks you&apos;ve planned — unplanned weeks are
            closed.
          </Text>
        </div>
        <Group gap="xs">
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => setWeek(dayjs(week).subtract(7, "day").format("YYYY-MM-DD"))}
            aria-label="Previous week"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Badge variant="light" size="lg">
            {weekLabel}
          </Badge>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={() => setWeek(dayjs(week).add(7, "day").format("YYYY-MM-DD"))}
            aria-label="Next week"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
          <Button variant="default" leftSection={<IconCopy size={16} />} onClick={copyPreviousWeek}>
            Copy previous week
          </Button>
        </Group>
      </Group>

      {conflicts.length > 0 && (
        <Alert
          variant="light"
          color="orange"
          icon={<IconAlertTriangle size={18} />}
          title="Resolve these bookings, then save again"
        >
          <Stack gap="xs">
            {conflicts.map((c) => (
              <Group key={c.id} justify="space-between" wrap="nowrap">
                <Text size="sm">
                  {dayjs(c.start).format("ddd D MMM HH:mm")} ·{" "}
                  {dbShootTypeLabel[c.shootType]} · {c.projectName} ({c.agentName})
                </Text>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="red"
                  onClick={() => resolveConflict(c.id, "cancel")}
                >
                  Cancel booking
                </Button>
              </Group>
            ))}
            <Text size="xs" c="dimmed">
              To keep a booking instead, reassign it from the Bookings screen,
              or soften the role.
            </Text>
          </Stack>
        </Alert>
      )}

      {rows === null ? (
        <Skeleton height={420} radius="lg" />
      ) : (
        <Stack gap="sm">
          {rows.map((r) => (
            <PlanRowCard key={r.creatorId} row={r} onChange={(patch) => updateRow(r.creatorId, patch)} />
          ))}
        </Stack>
      )}

      <Group justify="flex-end">
        <Button leftSection={<IconDeviceFloppy size={16} />} loading={saving} onClick={save}>
          Save week plan
        </Button>
      </Group>
    </Stack>
  );
}

function PlanRowCard({
  row,
  onChange,
}: {
  row: PlanRow;
  onChange: (patch: Partial<PlanRow>) => void;
}) {
  const custom = row.workingHours !== null;
  const hours = row.workingHours ?? row.defaultHours;

  return (
    <Card padding="sm">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" miw={220}>
          <Switch
            checked={row.planned}
            onChange={(e) => onChange({ planned: e.currentTarget.checked })}
            label={
              <Text fw={600} size="sm">
                {row.creatorName}
              </Text>
            }
          />
          {!row.planned && (
            <Badge color="gray" variant="light" size="sm">
              Closed this week
            </Badge>
          )}
        </Group>
        {row.planned && (
          <Group gap="sm">
            <SegmentedControl
              size="xs"
              value={row.role}
              onChange={(v) => onChange({ role: v as PlanRow["role"] })}
              data={[
                { label: "All", value: "all" },
                { label: "Photo only", value: "photo_only" },
                { label: "Video only", value: "video_only" },
                { label: "Company only", value: "company_only" },
              ]}
            />
            <Switch
              size="xs"
              label="Custom hours"
              checked={custom}
              onChange={(e) =>
                onChange({
                  workingHours: e.currentTarget.checked
                    ? { ...row.defaultHours }
                    : null,
                })
              }
            />
          </Group>
        )}
      </Group>

      <Collapse expanded={row.planned && custom}>
        <div style={{ marginTop: 8 }}>
          <WeekHoursEditor
            value={hours}
            onChange={(next) => onChange({ workingHours: next })}
          />
        </div>
      </Collapse>
    </Card>
  );
}
