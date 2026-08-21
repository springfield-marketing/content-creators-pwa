"use client";

// General permits: codes covering routine company content rather than one
// client project. Work logged under an active code here is reviewed by a
// manager — it never reaches a team lead's queue.
//
// Lives under /permits alongside the offplan registry so there is one place to
// look for a permit, but the two remain different things: these decide WHO
// REVIEWS a deliverable, offplan ones decide WHETHER A PROJECT MAY BE MARKETED.
// Still manager-only, and still served by /api/admin/permits — the API did not
// move, only the screen.

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import {
  IconPencil,
  IconPlus,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";

type Permit = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  expiresOn: string | null;
  uses: number;
};

// Expiry warns, it never changes routing — work under an expired code still
// goes to managers until someone switches it off.
function expiry(p: Permit): { text: string; color?: string } {
  if (!p.expiresOn) return { text: "No expiry" };
  const days = dayjs(p.expiresOn).startOf("day").diff(dayjs().startOf("day"), "day");
  const on = dayjs(p.expiresOn).format("D MMM YYYY");
  if (days < 0) return { text: `Expired ${on}`, color: "red" };
  if (days === 0) return { text: `Expires today (${on})`, color: "red" };
  if (days <= 30) return { text: `${days}d left (${on})`, color: "orange" };
  return { text: on };
}

export default function GeneralPermits() {
  const [permits, setPermits] = useState<Permit[] | null>(null);
  const [form, setForm] = useState({ code: "", label: "" });
  const [expires, setExpires] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formOpen, { open: openForm, close: closeForm }] = useDisclosure(false);
  // Edit dialog, reusing the same fields against an existing row.
  const [editing, setEditing] = useState<Permit | null>(null);
  const [editForm, setEditForm] = useState({ code: "", label: "" });
  const [editExpires, setEditExpires] = useState<string | null>(null);
  const [editOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false);

  const reload = useCallback(() => {
    fetch("/api/admin/permits")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPermits)
      .catch(() =>
        notifications.show({
          title: "Couldn't load permits",
          message: "Try refreshing.",
          color: "red",
        })
      );
  }, []);
  useEffect(reload, [reload]);

  const add = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/permits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, expiresOn: expires }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      notifications.show({
        title: "Couldn't add",
        message: body.error ?? (body.issues?.[0]?.message || "Check the details."),
        color: "red",
      });
      return;
    }
    notifications.show({
      title: "General permit added",
      message: `${body.code} — work logged under it now goes to a manager.`,
      color: "green",
    });
    closeForm();
    setForm({ code: "", label: "" });
    setExpires(null);
    reload();
  };

  const startEdit = (p: Permit) => {
    setEditing(p);
    setEditForm({ code: p.code, label: p.label });
    setEditExpires(p.expiresOn);
    openEdit();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/admin/permits/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, expiresOn: editExpires }),
    });
    setSaving(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      notifications.show({
        title: "Couldn't save",
        message: body.error ?? (body.issues?.[0]?.message || "Check the details."),
        color: "red",
      });
      return;
    }
    notifications.show({ title: "Permit updated", message: editForm.label, color: "green" });
    closeEdit();
    setEditing(null);
    reload();
  };

  const toggle = async (p: Permit) => {
    const res = await fetch(`/api/admin/permits/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (!res.ok) {
      notifications.show({ title: "Couldn't update", message: "Try again.", color: "red" });
      return;
    }
    notifications.show({
      title: p.isActive ? "Switched off" : "Switched on",
      message: p.isActive
        ? `${p.code} is a normal permit again — team leads will see this work.`
        : `${p.code} is general again — managers only.`,
      color: p.isActive ? "orange" : "green",
    });
    reload();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>General permits</Title>
          <Text size="sm" c="dimmed">
            Codes covering routine company content. Videos logged under one are
            reviewed by a manager and stay out of team leads&apos; queues.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openForm}>
          Add permit
        </Button>
      </Group>

      <Modal
        opened={formOpen}
        onClose={closeForm}
        title="Add general permit"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Permit code"
            description="Paste it as you received it — only the digits are stored and matched."
            placeholder="e.g. General QR code 2113748196"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.currentTarget.value })}
          />
          <TextInput
            label="What it covers"
            placeholder="e.g. Company meetings & activations"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
          />
          <DatePickerInput
            label="Expires on"
            description="Optional. Flags the permit for renewal — it keeps routing to managers either way."
            placeholder="No expiry"
            clearable
            valueFormat="D MMM YYYY"
            value={expires}
            onChange={setExpires}
          />
          <Group justify="flex-end">
            <Button loading={saving} onClick={add}>
              Add permit
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={closeEdit}
        title="Edit general permit"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Permit code"
            description="Only the digits are stored and matched."
            value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.currentTarget.value })}
          />
          {editing !== null && editing.uses > 0 && (
            <Alert variant="light" color="orange" p="xs">
              <Text size="xs">
                {editing.uses}{" "}
                {editing.uses === 1 ? "deliverable matches" : "deliverables match"}{" "}
                {editing.code}. Changing the code re-points that match, so those
                stop counting as general and any work under the new code starts.
              </Text>
            </Alert>
          )}
          <TextInput
            label="What it covers"
            value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.currentTarget.value })}
          />
          <DatePickerInput
            label="Expires on"
            placeholder="No expiry"
            clearable
            valueFormat="D MMM YYYY"
            value={editExpires}
            onChange={setEditExpires}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeEdit}>
              Cancel
            </Button>
            <Button loading={saving} onClick={saveEdit}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {permits === null ? (
        <Skeleton height={220} radius="lg" />
      ) : permits.length === 0 ? (
        <Alert variant="light" color="blue">
          No general permits yet — every video goes to the normal review queue.
        </Alert>
      ) : (
        <Card padding="xs">
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Covers</Table.Th>
                <Table.Th>Used by</Table.Th>
                <Table.Th>Expires</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {permits.map((p) => (
                <Table.Tr key={p.id} opacity={p.isActive ? 1 : 0.5}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {p.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.label}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {p.uses} {p.uses === 1 ? "deliverable" : "deliverables"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={expiry(p).color ?? "dimmed"}>
                      {expiry(p).text}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={p.isActive ? "green" : "gray"}
                    >
                      {p.isActive ? "general" : "off"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                    <Button
                      size="compact-xs"
                      variant="default"
                      leftSection={<IconPencil size={14} />}
                      onClick={() => startEdit(p)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color={p.isActive ? "orange" : "green"}
                      leftSection={
                        p.isActive ? (
                          <IconToggleLeft size={14} />
                        ) : (
                          <IconToggleRight size={14} />
                        )
                      }
                      onClick={() => toggle(p)}
                    >
                      {p.isActive ? "Switch off" : "Switch on"}
                    </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
