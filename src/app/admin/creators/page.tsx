"use client";

// Screen 13 — Creator settings & time off, on real data. Time off enforces
// §B12.2: conflicting confirmed bookings must be reassigned or cancelled
// before the leave can be saved.

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
    Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { WeekHoursEditor, type Hours } from "@/components/WeekHoursEditor";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

type TimeOffEntry = { id: string; from: string; to: string; reason: string | null };
type Craft = "video" | "photo" | "both";
type CreatorRow = {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  slug: string | null;
  isActive: boolean;
  resignedOn: string | null;
  craft: Craft;
  roles: string[];
  workingHours: Hours;
  shootDurations: { photo: number; video: number; photo_video: number };
  bufferMinutes: number;
  minNoticeHours: number;
  maxHorizonDays: number;
  maxShootsPerDay: number;
  timeOff: TimeOffEntry[];
};
type Conflict = {
  id: string;
  start: string;
  projectName: string | null;
  shootType: DbShootType;
  agentName: string | null;
};

export default function CreatorSettings() {
  const [creators, setCreators] = useState<CreatorRow[] | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [hours, setHours] = useState<Hours | null>(null);
  const [rules, setRules] = useState({
    photo: 90, video: 150, photo_video: 180,
    buffer: 30, notice: 24, horizon: 28, maxPerDay: 3,
  });
  const [leaveRange, setLeaveRange] = useState<[string | null, string | null]>([null, null]);
  const [leaveReason, setLeaveReason] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [craft, setCraft] = useState<Craft>("video");
  const [details, setDetails] = useState({ name: "", email: "" });
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [resignOpen, { open: openResign, close: closeResign }] = useDisclosure(false);
  const [resigning, setResigning] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", branch: "Dubai" });
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const creator = (creators ?? []).find((c) => c.id === creatorId) ?? null;

  const loadIntoForm = useCallback((c: CreatorRow) => {
    setHours({ ...c.workingHours });
    setRules({
      photo: c.shootDurations.photo,
      video: c.shootDurations.video,
      photo_video: c.shootDurations.photo_video,
      buffer: c.bufferMinutes,
      notice: c.minNoticeHours,
      horizon: c.maxHorizonDays,
      maxPerDay: c.maxShootsPerDay,
    });
    setCraft(c.craft);
    setDetails({ name: c.name, email: c.email });
    setIsTeamLead(c.roles.includes("team_lead"));
    setNewPhoto(null);
    setLeaveRange([null, null]);
    setLeaveReason("");
    setConflicts(null);
  }, []);

  // Refresh list data without clobbering the form.
  const reload = useCallback(() => {
    fetch("/api/admin/creators")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: CreatorRow[]) => setCreators(rows))
      .catch(() =>
        notifications.show({ title: "Couldn't load creators", message: "Refresh.", color: "red" })
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/creators")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: CreatorRow[]) => {
        if (cancelled) return;
        setCreators(rows);
        if (rows[0]) {
          setCreatorId(rows[0].id);
          loadIntoForm(rows[0]);
        }
      })
      .catch(() =>
        notifications.show({ title: "Couldn't load creators", message: "Refresh.", color: "red" })
      );
    return () => {
      cancelled = true;
    };
  }, [loadIntoForm]);

  const switchCreator = (id: string | null) => {
    if (!id) return;
    setCreatorId(id);
    const c = (creators ?? []).find((x) => x.id === id);
    if (c) loadIntoForm(c);
  };

  const saveSettings = async () => {
    if (!creator || !hours) return;
    setSaving(true);
    const res = await fetch(`/api/admin/creators/${creator.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workingHours: hours,
        shootDurations: {
          photo: rules.photo,
          video: rules.video,
          photo_video: rules.photo_video,
        },
        bufferMinutes: rules.buffer,
        minNoticeHours: rules.notice,
        maxHorizonDays: rules.horizon,
        maxShootsPerDay: rules.maxPerDay,
        craft,
        isTeamLead,
      }),
    });
    setSaving(false);
    notifications.show(
      res.ok
        ? {
            title: "Settings saved",
            message: `Bookable slots for ${creator.name} update immediately.`,
            color: "green",
          }
        : { title: "Save failed", message: "Check the values.", color: "red" }
    );
    if (res.ok) reload();
  };

  const checkConflicts = async (from: string, to: string) => {
    if (!creator) return;
    const res = await fetch(
      `/api/admin/creators/${creator.id}/time-off?from=${from}&to=${to}`
    );
    if (res.ok) {
      const d = await res.json();
      setConflicts(d.conflicts);
    }
  };

  const resolveConflict = async (bookingId: string, how: "cancel" | "reassign", targetId?: string) => {
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        how === "cancel"
          ? { action: "cancel", reason: "Creator unavailable (time off)" }
          : { action: "reassign", creatorId: targetId }
      ),
    });
    const body = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? {
            title: how === "cancel" ? "Booking cancelled" : "Booking reassigned",
            message: "Agent notified automatically.",
            color: how === "cancel" ? "red" : "green",
          }
        : { title: "Couldn't resolve", message: body.error ?? "Try again.", color: "red" }
    );
    if (res.ok && leaveRange[0] && leaveRange[1]) {
      checkConflicts(leaveRange[0], leaveRange[1]);
    }
  };

  const addLeave = async () => {
    if (!creator || !leaveRange[0] || !leaveRange[1]) return;
    const res = await fetch(`/api/admin/creators/${creator.id}/time-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: leaveRange[0],
        to: leaveRange[1],
        reason: leaveReason || "Time off",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      setConflicts(body.conflicts ?? []);
      notifications.show({
        title: "Conflicts must be resolved first",
        message: body.error,
        color: "orange",
      });
      return;
    }
    notifications.show(
      res.ok
        ? {
            title: "Time off added",
            message: `${creator.name} is hidden from the booking page for that period.`,
            color: "green",
          }
        : { title: "Couldn't add time off", message: body.error ?? "Try again.", color: "red" }
    );
    if (res.ok) reload();
  };

  const removeLeave = async (entryId: string) => {
    if (!creator) return;
    const res = await fetch(
      `/api/admin/creators/${creator.id}/time-off?entryId=${entryId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      notifications.show({ title: "Time off removed", message: "", color: "blue" });
      reload();
    }
  };

  // Details and photo save together but travel separately: the photo is
  // multipart, everything else is the JSON PATCH.
  const saveDetails = async () => {
    if (!creator) return;
    setSavingDetails(true);

    const res = await fetch(`/api/admin/creators/${creator.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: details.name.trim(),
        email: details.email.trim().toLowerCase(),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSavingDetails(false);
      notifications.show({
        title: "Couldn't save details",
        message: body.error ?? (body.issues?.[0]?.message || "Check the values."),
        color: "red",
      });
      return;
    }

    if (newPhoto) {
      const fd = new FormData();
      fd.append("photo", newPhoto);
      const pRes = await fetch(`/api/admin/creators/${creator.id}/photo`, {
        method: "POST",
        body: fd,
      });
      if (!pRes.ok) {
        const body = await pRes.json().catch(() => ({}));
        setSavingDetails(false);
        notifications.show({
          title: "Details saved, photo didn't upload",
          message: body.error ?? "Try the photo again.",
          color: "orange",
        });
        reload();
        return;
      }
    }

    setSavingDetails(false);
    setNewPhoto(null);
    notifications.show({
      title: "Details saved",
      message: `${details.name} — the booking page updates immediately.`,
      color: "green",
    });
    reload();
  };

  const unresign = async () => {
    if (!creator) return;
    setResigning(true);
    const res = await fetch(`/api/admin/creators/${creator.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unresign" }),
    });
    setResigning(false);
    const body = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? {
            title: `${creator.name} is back`,
            message: `${body.restoredEmail} is theirs again.`,
            color: "green",
          }
        : { title: "Couldn't undo", message: body.error ?? "Try again.", color: "red" }
    );
    if (res.ok) reload();
  };

  const resign = async () => {
    if (!creator) return;
    setResigning(true);
    const res = await fetch(`/api/admin/creators/${creator.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resign" }),
    });
    setResigning(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      notifications.show({
        title: "Couldn't resign",
        message: body.error ?? "Try again.",
        color: "red",
      });
      return;
    }
    notifications.show({
      title: `${creator.name} marked as resigned`,
      message: `${body.freedEmail} is free for their replacement.`,
      color: "orange",
    });
    closeResign();
    reload();
  };

  const resetAddForm = () => {
    setAddForm({ name: "", email: "", branch: "Dubai" });
    setAddPhoto(null);
  };

  const addCreator = async () => {
    setAdding(true);
    const body = new FormData();
    body.append("fullName", addForm.name);
    body.append("email", addForm.email);
    body.append("branch", addForm.branch);
    if (addPhoto) body.append("photo", addPhoto);

    const res = await fetch("/api/admin/creators", { method: "POST", body });
    setAdding(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notifications.show({
        title: "Couldn't add creator",
        message: data.error ?? (data.issues?.[0]?.message || "Check the details."),
        color: "red",
      });
      return;
    }
    notifications.show({
      title: "Creator added",
      message: data.calendarOk
        ? `${addForm.name} is now on the booking page.`
        : `${addForm.name} was added, but their Google Calendar isn't reachable — check domain-wide delegation before they take bookings.`,
      color: data.calendarOk ? "green" : "yellow",
    });
    closeAdd();
    resetAddForm();
    reload();
  };

  if (creators === null || !creator || !hours) {
    return (
      <Stack gap="md">
        <Skeleton height={32} width={280} />
        <Skeleton height={380} radius="lg" />
      </Stack>
    );
  }

  const otherCreators = creators.filter((c) => c.id !== creator.id && c.isActive);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Creator settings &amp; time off</Title>
          <Text size="sm" c="dimmed">
            Shapes the bookable slots — creators never see or edit this.
          </Text>
        </div>
        <Group gap="sm" align="flex-end">
          <Select
            data={creators.map((c) => ({
              value: c.id,
              label: c.isActive ? c.name : `${c.name} (resigned)`,
            }))}
            value={creatorId}
            onChange={switchCreator}
            allowDeselect={false}
            maw={220}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
            Add creator
          </Button>
        </Group>
      </Group>

      <Modal
        opened={resignOpen}
        onClose={closeResign}
        title={`Mark ${creator.name} as resigned?`}
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Their shoots, deliverables and review history stay exactly where
            they are — nothing is deleted.
          </Text>
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
            <Stack gap={4}>
              <Text size="sm">
                They come off the booking page and can no longer sign in.
              </Text>
              <Text size="sm">
                Their email is freed for whoever replaces them, so add the new
                creator with the same address afterwards.
              </Text>
              <Text size="sm" fw={500}>
                Undoing this needs a database change.
              </Text>
            </Stack>
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeResign}>
              Cancel
            </Button>
            <Button color="red" loading={resigning} onClick={resign}>
              Mark as resigned
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={addOpen}
        onClose={() => {
          closeAdd();
          resetAddForm();
        }}
        title="Add creator"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Full name"
            placeholder="Jericho Ramos"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.currentTarget.value })}
          />
          <TextInput
            label="Google Workspace email"
            description="Also used as their booking calendar."
            placeholder="media11@springfield-re.com"
            value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.currentTarget.value })}
          />
          <Select
            label="Branch"
            data={["Dubai", "Abu Dhabi"]}
            value={addForm.branch}
            onChange={(v) => setAddForm({ ...addForm, branch: v ?? "Dubai" })}
            allowDeselect={false}
          />
          <FileInput
            label="Photo"
            description="Optional — shown on the booking card. Max 5MB."
            placeholder="Choose an image"
            accept="image/*"
            clearable
            value={addPhoto}
            onChange={setAddPhoto}
          />
          <Text size="xs" c="dimmed">
            Booking hours and shoot durations start from the company defaults —
            adjust them on this screen after adding.
          </Text>

          <Group justify="flex-end">
            <Button loading={adding} onClick={addCreator}>
              Add creator
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card>
        <Stack gap="sm">
          <Text fw={600}>Details</Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <TextInput
              label="Full name"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.currentTarget.value })}
            />
            <TextInput
              label="Google Workspace email"
              description="Also the calendar bookings land on."
              value={details.email}
              onChange={(e) => setDetails({ ...details, email: e.currentTarget.value })}
            />
            <FileInput
              label="Replace photo"
              description={creator.photoUrl ? "A photo is set." : "No photo yet."}
              placeholder="Choose an image"
              accept="image/*"
              clearable
              value={newPhoto}
              onChange={setNewPhoto}
            />
          </SimpleGrid>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Booking link stays /book/{creator.slug} — renaming doesn&apos;t
              change it, so shared links keep working.
            </Text>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              loading={savingDetails}
              disabled={details.name.trim().length < 2 || !details.email.trim()}
              onClick={saveDetails}
            >
              Save details
            </Button>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <Text fw={600}>Working hours</Text>
            <WeekHoursEditor value={hours} onChange={setHours} />
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Text fw={600}>Booking rules</Text>
            <SimpleGrid cols={2} spacing="sm">
              <NumberInput label="Photo shoot (min)" value={rules.photo} onChange={(v) => setRules({ ...rules, photo: Number(v) || 0 })} min={15} step={15} />
              <NumberInput label="Video shoot (min)" value={rules.video} onChange={(v) => setRules({ ...rules, video: Number(v) || 0 })} min={15} step={15} />
              <NumberInput label="Photo + Video (min)" value={rules.photo_video} onChange={(v) => setRules({ ...rules, photo_video: Number(v) || 0 })} min={15} step={15} />
              <NumberInput label="Buffer between shoots (min)" value={rules.buffer} onChange={(v) => setRules({ ...rules, buffer: Number(v) || 0 })} min={0} step={15} />
              <NumberInput label="Minimum notice (hours)" value={rules.notice} onChange={(v) => setRules({ ...rules, notice: Number(v) || 0 })} min={0} />
              <NumberInput label="Booking horizon (days)" value={rules.horizon} onChange={(v) => setRules({ ...rules, horizon: Number(v) || 1 })} min={1} />
              <NumberInput label="Max shoots per day" value={rules.maxPerDay} onChange={(v) => setRules({ ...rules, maxPerDay: Number(v) || 1 })} min={1} />
            </SimpleGrid>
            <Checkbox
              label="Can review other creators' work"
              description="Adds the review queue. They still can't approve their own, and general-permit work stays with managers."
              checked={isTeamLead}
              onChange={(e) => setIsTeamLead(e.currentTarget.checked)}
            />
            {isTeamLead !== creator.roles.includes("team_lead") && (
              <Alert color="blue" variant="light" p="xs">
                <Text size="xs">
                  Sign-in details are read when someone logs in, so{" "}
                  {creator.name.split(" ")[0]} needs to sign out and back in
                  before this takes effect.
                </Text>
              </Alert>
            )}
            <Select
              label="Measured on"
              description="Which targets apply on the KPI targets screen."
              data={[
                { value: "video", label: "Video — clips delivered" },
                { value: "photo", label: "Photo — images delivered" },
                { value: "both", label: "Both — a target in each" },
              ]}
              value={craft}
              onChange={(v) => setCraft((v as Craft) ?? "video")}
              allowDeselect={false}
              maw={280}
            />
            <Group justify="space-between">
              {creator.resignedOn ? (
                <Group gap="sm">
                  <Text size="xs" c="dimmed">
                    Resigned {dayjs(creator.resignedOn).format("D MMM YYYY")}
                  </Text>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    loading={resigning}
                    onClick={unresign}
                  >
                    Undo
                  </Button>
                </Group>
              ) : (
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  onClick={openResign}
                >
                  Mark as resigned
                </Button>
              )}
              <Button leftSection={<IconDeviceFloppy size={16} />} loading={saving} onClick={saveSettings}>
                Save settings
              </Button>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card>
        <Stack gap="sm">
          <Text fw={600}>Time off</Text>

          {creator.timeOff.length > 0 ? (
            <Stack gap={6}>
              {creator.timeOff.map((t) => (
                <Group key={t.id} gap="sm">
                  <Badge variant="light" color="gray">
                    {dayjs(t.from).format("D MMM")} – {dayjs(t.to).format("D MMM")}
                  </Badge>
                  <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                    {t.reason}
                  </Text>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={12} />}
                    onClick={() => removeLeave(t.id)}
                  >
                    Remove
                  </Button>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No upcoming time off.
            </Text>
          )}

          <Divider label="Add leave" />
          <Group align="flex-end" wrap="wrap">
            <DatePickerInput
              type="range"
              label="Leave period"
              placeholder="Pick a date range"
              value={leaveRange}
              onChange={(v) => {
                setLeaveRange(v);
                if (v[0] && v[1]) checkConflicts(v[0], v[1]);
                else setConflicts(null);
              }}
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
              disabled={
                !leaveRange[0] || !leaveRange[1] || (conflicts?.length ?? 0) > 0
              }
              onClick={addLeave}
            >
              Add time off
            </Button>
          </Group>

          {conflicts && conflicts.length > 0 && (
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={18} />}
              title={`${conflicts.length} confirmed booking${conflicts.length > 1 ? "s" : ""} inside this range`}
            >
              <Stack gap="xs">
                <Text size="sm">
                  Each one must be reassigned or cancelled before the leave can
                  be saved — agents are notified automatically.
                </Text>
                {conflicts.map((b) => (
                  <ConflictRow
                    key={b.id}
                    conflict={b}
                    others={otherCreators}
                    onResolve={resolveConflict}
                  />
                ))}
              </Stack>
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function ConflictRow({
  conflict,
  others,
  onResolve,
}: {
  conflict: Conflict;
  others: { id: string; name: string }[];
  onResolve: (id: string, how: "cancel" | "reassign", targetId?: string) => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  return (
    <Group justify="space-between" wrap="wrap">
      <Text size="sm">
        {dayjs(conflict.start).format("ddd D MMM HH:mm")} ·{" "}
        {dbShootTypeLabel[conflict.shootType]} · {conflict.projectName} (
        {conflict.agentName})
      </Text>
      <Group gap={6}>
        <Select
          size="xs"
          placeholder="Reassign to…"
          data={others.map((c) => ({ value: c.id, label: c.name }))}
          value={target}
          onChange={setTarget}
          maw={170}
        />
        <Button
          size="compact-xs"
          variant="default"
          disabled={!target}
          onClick={() => onResolve(conflict.id, "reassign", target!)}
        >
          Reassign
        </Button>
        <Button
          size="compact-xs"
          variant="light"
          color="red"
          onClick={() => onResolve(conflict.id, "cancel")}
        >
          Cancel
        </Button>
      </Group>
    </Group>
  );
}
