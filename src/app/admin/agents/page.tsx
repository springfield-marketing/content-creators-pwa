"use client";

import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
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
import { agents as initialAgents, type Agent } from "@/lib/mock-data";

const emptyForm = { name: "", office: "", email: "", phone: "" };

// Screen 11 — Agents admin: the master list plus the approval inbox.
export default function AgentsAdmin() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [formOpen, { open: openForm, close: closeForm }] = useDisclosure(false);

  const pending = agents.filter((a) => a.status === "pending");
  const list = useMemo(
    () =>
      agents
        .filter((a) => a.status !== "pending")
        .filter(
          (a) =>
            search.trim() === "" ||
            `${a.name} ${a.office} ${a.email}`
              .toLowerCase()
              .includes(search.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [agents, search]
  );

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    openForm();
  };

  const startEdit = (a: Agent) => {
    setEditing(a);
    setForm({ name: a.name, office: a.office, email: a.email, phone: a.phone });
    openForm();
  };

  const saveForm = () => {
    if (editing) {
      setAgents((all) =>
        all.map((a) => (a.id === editing.id ? { ...a, ...form } : a))
      );
      notifications.show({ title: "Agent updated", message: form.name, color: "green" });
    } else {
      setAgents((all) => [
        ...all,
        { id: `new-${all.length}`, ...form, status: "active" },
      ]);
      notifications.show({ title: "Agent added", message: form.name, color: "green" });
    }
    closeForm();
  };

  const toggleActive = (a: Agent) => {
    const next = a.status === "active" ? "inactive" : "active";
    setAgents((all) =>
      all.map((x) => (x.id === a.id ? { ...x, status: next } : x))
    );
    notifications.show({
      title: next === "inactive" ? "Agent deactivated" : "Agent reactivated",
      message:
        next === "inactive"
          ? `${a.name} no longer appears in booking search.`
          : `${a.name} can book again.`,
      color: next === "inactive" ? "orange" : "green",
    });
  };

  const decide = (a: Agent, ok: boolean) => {
    setAgents((all) =>
      all.map((x) =>
        x.id === a.id ? { ...x, status: ok ? "active" : "inactive" } : x
      )
    );
    notifications.show({
      title: ok ? "Agent approved" : "Registration rejected",
      message: a.name,
      color: ok ? "green" : "red",
    });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Agents</Title>
          <Text size="sm" c="dimmed">
            {agents.filter((a) => a.status === "active").length} active ·
            mock slice of the real 200+ list
          </Text>
        </div>
        <Group>
          <Button
            variant="default"
            leftSection={<IconFileImport size={16} />}
            onClick={() =>
              notifications.show({
                title: "CSV import",
                message:
                  "Wired in stage 2 — used once to load the initial 200+ agents.",
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
                      <Table.Tr key={a.id} opacity={a.status === "inactive" ? 0.5 : 1}>
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
                            color={a.status === "active" ? "green" : "gray"}
                          >
                            {a.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" aria-label="Agent actions">
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
                                color={a.status === "active" ? "red" : "green"}
                                onClick={() => toggleActive(a)}
                              >
                                {a.status === "active" ? "Deactivate" : "Reactivate"}
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
                        {a.name} — {a.office}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {a.email} · {a.phone} · self-registered during booking
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
