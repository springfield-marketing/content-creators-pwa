"use client";

// Team access: who can sign in as manager (full admin) or executive
// (read-only reports). Deactivation blocks sign-in immediately.

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconUserOff, IconUserUp } from "@tabler/icons-react";

type Member = {
  id: string;
  name: string;
  email: string;
  roles: ("creator" | "team_lead" | "manager" | "executive")[];
  isActive: boolean;
};

export default function Team() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "manager" });
  const [saving, setSaving] = useState(false);
  const [formOpen, { open: openForm, close: closeForm }] = useDisclosure(false);

  const reload = useCallback(() => {
    fetch("/api/admin/team")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMembers)
      .catch(() =>
        notifications.show({
          title: "Couldn't load the team",
          message: "Try refreshing.",
          color: "red",
        })
      );
  }, []);
  useEffect(reload, [reload]);

  const add = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.name,
        email: form.email,
        role: form.role,
      }),
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
      title: "Access granted",
      message: `${form.name} can sign in with their Google account now.`,
      color: "green",
    });
    closeForm();
    setForm({ name: "", email: "", role: "manager" });
    reload();
  };

  const toggle = async (m: Member) => {
    const res = await fetch(`/api/admin/team/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    const body = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? {
            title: m.isActive ? "Access removed" : "Access restored",
            message: m.email,
            color: m.isActive ? "orange" : "green",
          }
        : { title: "Not allowed", message: body.error ?? "Try again.", color: "red" }
    );
    if (res.ok) reload();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Team access</Title>
          <Text size="sm" c="dimmed">
            Managers have full admin access; executives see reports only.
            Creators are managed on the Creators screen.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openForm}>
          Add member
        </Button>
      </Group>

      {members === null ? (
        <Skeleton height={220} radius="lg" />
      ) : (
        <Card padding="xs">
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.map((m) => (
                <Table.Tr key={m.id} opacity={m.isActive ? 1 : 0.5}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {m.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>{m.email}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {m.roles.map((r) => (
                        <Badge
                          key={r}
                          size="sm"
                          variant="light"
                          color={r === "manager" ? "brand" : "gray"}
                        >
                          {r}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={m.isActive ? "green" : "gray"}
                    >
                      {m.isActive ? "active" : "deactivated"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color={m.isActive ? "red" : "green"}
                      leftSection={
                        m.isActive ? <IconUserOff size={12} /> : <IconUserUp size={12} />
                      }
                      onClick={() => toggle(m)}
                    >
                      {m.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <Modal opened={formOpen} onClose={closeForm} title="Add team member" centered>
        <Stack gap="sm">
          <TextInput
            label="Full name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <TextInput
            label="Company Google email"
            required
            placeholder="name@springfield-re.com"
            description="They sign in with this Google account — a typo means access denied."
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Role
            </Text>
            <SegmentedControl
              fullWidth
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              data={[
                { label: "Manager (full admin)", value: "manager" },
                { label: "Executive (reports only)", value: "executive" },
              ]}
            />
          </div>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={form.name.trim().length < 2 || !form.email.includes("@")}
              onClick={add}
            >
              Grant access
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
