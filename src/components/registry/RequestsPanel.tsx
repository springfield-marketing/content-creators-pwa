"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Autocomplete,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";

type RequestRow = {
  id: number;
  requestedByEmail: string;
  requestedProjectName: string | null;
  note: string | null;
  status: "new" | "in_progress" | "issued" | "rejected";
  createdAt: string;
  projectId: number | null;
  projectName: string | null;
  dldProjectNumber: string | null;
};

const STATUS_COLOR: Record<RequestRow["status"], string> = {
  new: "blue",
  in_progress: "orange",
  issued: "green",
  rejected: "gray",
};

const STATUS_LABEL: Record<RequestRow["status"], string> = {
  new: "New",
  in_progress: "In progress",
  issued: "Issued",
  rejected: "Rejected",
};

export function RequestsPanel({
  canRequest,
  showRequester,
  projects,
}: {
  canRequest: boolean;
  /** Admins see the whole queue, so they need to know who asked. */
  showRequester: boolean;
  projects: { id: number; name: string }[];
}) {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [projectName, setProjectName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    fetch("/api/permits/requests")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRows)
      .catch(() =>
        notifications.show({
          title: "Couldn't load requests",
          message: "Try refreshing.",
          color: "red",
        }),
      );
  }, []);
  useEffect(reload, [reload]);

  const submit = async () => {
    const typed = projectName.trim();
    if (!typed) return;
    setSaving(true);
    // An exact name match links the request to the tracked project; anything
    // else is recorded as free text for an admin to resolve.
    const match = projects.find(
      (p) => p.name.toLowerCase() === typed.toLowerCase(),
    );
    const res = await fetch("/api/permits/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: match?.id ?? null,
        projectName: match ? undefined : typed,
        note: note.trim() || undefined,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      notifications.show({
        title: "Couldn't raise the request",
        message: error || "Try again.",
        color: "red",
      });
      return;
    }

    setProjectName("");
    setNote("");
    close();
    reload();
    notifications.show({
      title: "Request raised",
      message: "Marketing will pick it up.",
      color: "green",
    });
  };

  return (
    <>
      {canRequest && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Request a permit
          </Button>
        </Group>
      )}

      <Card withBorder radius="md" p={0}>
        {rows === null && (
          <Text size="sm" c="dimmed" p="md">
            Loading…
          </Text>
        )}

        {rows?.length === 0 && (
          <Stack align="center" py="xl" gap="xs">
            <Text size="sm" c="dimmed">
              No requests yet.
            </Text>
            {canRequest && (
              <Text size="xs" c="dimmed">
                Raise one when a project you need isn&apos;t listed.
              </Text>
            )}
          </Stack>
        )}

        {rows && rows.length > 0 && (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                {showRequester && <Table.Th>Requested by</Table.Th>}
                <Table.Th>Note</Table.Th>
                <Table.Th>Raised</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {r.projectName ?? r.requestedProjectName ?? "—"}
                    </Text>
                    {!r.projectId && (
                      <Text size="xs" c="dimmed">
                        Not tracked yet
                      </Text>
                    )}
                  </Table.Td>
                  {showRequester && (
                    <Table.Td>
                      <Text size="xs">{r.requestedByEmail}</Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {r.note ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">
                      {new Date(r.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLOR[r.status]}
                      variant="light"
                      size="sm"
                    >
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal opened={opened} onClose={close} title="Request a permit" centered>
        <Stack>
          <Autocomplete
            label="Project"
            placeholder="Start typing the project name"
            data={projects.map((p) => p.name)}
            value={projectName}
            onChange={setProjectName}
            limit={8}
            description="Pick a tracked project, or type a name if it isn't listed yet."
            data-autofocus
          />
          <Textarea
            label="Note"
            placeholder="Anything marketing should know — deadline, campaign, portal"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            minRows={3}
            autosize
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              loading={saving}
              disabled={!projectName.trim()}
            >
              Send request
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
