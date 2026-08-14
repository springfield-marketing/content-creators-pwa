"use client";

// General permits: codes covering routine company content rather than one
// client project. Work logged under an active code here is reviewed by a
// manager — it never reaches a team lead's queue.

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
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconToggleLeft, IconToggleRight } from "@tabler/icons-react";

type Permit = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  uses: number;
};

export default function GeneralPermits() {
  const [permits, setPermits] = useState<Permit[] | null>(null);
  const [form, setForm] = useState({ code: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [formOpen, { open: openForm, close: closeForm }] = useDisclosure(false);

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
      body: JSON.stringify(form),
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
          <Group justify="flex-end">
            <Button loading={saving} onClick={add}>
              Add permit
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
                    <Badge
                      size="sm"
                      variant="light"
                      color={p.isActive ? "green" : "gray"}
                    >
                      {p.isActive ? "general" : "off"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
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
