"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconDots,
  IconFileImport,
  IconPencil,
  IconPlus,
  IconSearch,
  IconUserOff,
  IconX,
} from "@tabler/icons-react";

type AgentRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  office: string | null;
  isApproved: boolean;
  isActive: boolean;
};

const emptyForm = { name: "", office: "", email: "", phone: "" };

async function apiCall(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return res;
}

// Screen 11 — Agents admin: the master list plus the approval inbox.
export default function AgentsAdmin() {
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<AgentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formOpen, { open: openForm, close: closeForm }] = useDisclosure(false);

  const reload = useCallback(() => {
    fetch("/api/admin/agents")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAgents)
      .catch(() =>
        notifications.show({
          title: "Couldn't load agents",
          message: "Try refreshing the page.",
          color: "red",
        })
      );
  }, []);

  useEffect(reload, [reload]);

  const pending = useMemo(
    () => (agents ?? []).filter((a) => !a.isApproved && a.isActive),
    [agents]
  );
  const list = useMemo(
    () =>
      (agents ?? [])
        .filter((a) => a.isApproved || !a.isActive)
        .filter(
          (a) =>
            search.trim() === "" ||
            `${a.name} ${a.office ?? ""} ${a.email ?? ""}`
              .toLowerCase()
              .includes(search.toLowerCase())
        ),
    [agents, search]
  );

  const mutate = async (fn: () => Promise<unknown>, successTitle: string, message: string) => {
    try {
      await fn();
      notifications.show({ title: successTitle, message, color: "green" });
      reload();
    } catch (e) {
      notifications.show({
        title: "Something went wrong",
        message: e instanceof Error ? e.message : "Try again.",
        color: "red",
      });
    }
  };

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    openForm();
  };

  const startEdit = (a: AgentRow) => {
    setEditing(a);
    setForm({
      name: a.name,
      office: a.office ?? "",
      email: a.email ?? "",
      phone: a.phone ?? "",
    });
    openForm();
  };

  const saveForm = async () => {
    setSaving(true);
    const body = {
      fullName: form.name,
      email: form.email,
      phone: form.phone || undefined,
      office: form.office || undefined,
    };
    await mutate(
      () =>
        editing
          ? apiCall(`/api/admin/agents/${editing.id}`, "PATCH", body)
          : apiCall("/api/admin/agents", "POST", body),
      editing ? "Agent updated" : "Agent added",
      form.name
    );
    setSaving(false);
    closeForm();
  };

  const toggleActive = (a: AgentRow) =>
    mutate(
      () => apiCall(`/api/admin/agents/${a.id}`, "PATCH", { isActive: !a.isActive }),
      a.isActive ? "Agent deactivated" : "Agent reactivated",
      a.isActive
        ? `${a.name} no longer appears in booking search.`
        : `${a.name} can book again.`
    );

  const decide = (a: AgentRow, ok: boolean) =>
    mutate(
      () =>
        apiCall(
          `/api/admin/agents/${a.id}`,
          "PATCH",
          ok ? { isApproved: true } : { isApproved: false, isActive: false }
        ),
      ok ? "Agent approved" : "Registration rejected",
      a.name
    );

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Agents</Title>
          <Text size="sm" c="dimmed">
            {agents
              ? `${agents.filter((a) => a.isActive && a.isApproved).length} active agents`
              : "Loading…"}
          </Text>
        </div>
        <Group>
          <Button
            variant="default"
            leftSection={<IconFileImport size={16} />}
            onClick={() =>
              notifications.show({
                title: "CSV import",
                message: "The initial list is already imported — bulk updates come with phase 1.",
                color: "blue",
              })
            }
          >
            Import CSV
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={startAdd}>
            Add agent
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="all">
        <Tabs.List>
          <Tabs.Tab value="all">All agents</Tabs.Tab>
          <Tabs.Tab
            value="inbox"
            rightSection={
              pending.length > 0 && (
                <Badge size="xs" circle color="red">
                  {pending.length}
                </Badge>
              )
            }
          >
            Approval inbox
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="all" pt="md">
          <Stack gap="sm">
            <TextInput
              placeholder="Search name, office, or email"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              maw={320}
            />
            {agents === null ? (
              <Skeleton height={320} radius="lg" />
            ) : (
              <Card padding="xs">
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing="xs" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Office</Table.Th>
                        <Table.Th>Email</Table.Th>
                        <Table.Th>Phone</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {list.map((a) => (
                        <Table.Tr key={a.id} opacity={a.isActive ? 1 : 0.5}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {a.name}
                            </Text>
                          </Table.Td>
                          <Table.Td>{a.office}</Table.Td>
                          <Table.Td>{a.email}</Table.Td>
                          <Table.Td>{a.phone}</Table.Td>
                          <Table.Td>
                            <Badge
                              size="sm"
                              variant="light"
                              color={a.isActive ? "green" : "gray"}
                            >
                              {a.isActive ? "active" : "inactive"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Menu position="bottom-end">
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label="Agent actions"
                                >
                                  <IconDots size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<IconPencil size={14} />}
                                  onClick={() => startEdit(a)}
                                >
                                  Edit
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconUserOff size={14} />}
                                  color={a.isActive ? "red" : "green"}
                                  onClick={() => toggleActive(a)}
                                >
                                  {a.isActive ? "Deactivate" : "Reactivate"}
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="inbox" pt="md">
          {pending.length === 0 ? (
            <Alert variant="light" color="green">
              No registrations waiting for approval.
            </Alert>
          ) : (
            <Stack gap="xs">
              {pending.map((a) => (
                <Card key={a.id} padding="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={600}>
                        {a.name}
                        {a.office ? ` — ${a.office}` : ""}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {a.email} · {a.phone ?? "no phone"} · self-registered
                        during booking
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        color="green"
                        leftSection={<IconCheck size={14} />}
                        onClick={() => decide(a, true)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconX size={14} />}
                        onClick={() => decide(a, false)}
                      >
                        Reject
                      </Button>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={formOpen}
        onClose={closeForm}
        title={editing ? "Edit agent" : "Add agent"}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Full name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <TextInput
            label="Office"
            value={form.office}
            onChange={(e) => setForm({ ...form, office: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
          />
          <TextInput
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={form.name.trim() === "" || form.email.trim() === ""}
              onClick={saveForm}
            >
              {editing ? "Save changes" : "Add agent"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
