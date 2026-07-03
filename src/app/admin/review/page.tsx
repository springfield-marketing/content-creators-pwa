"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Kbd,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconExternalLink,
  IconMessage,
} from "@tabler/icons-react";
import {
  agentById,
  creatorById,
  creators,
  deliverables,
  type Deliverable,
} from "@/lib/mock-data";

const typeLabel: Record<Deliverable["type"], string> = {
  photo_shoot: "Photo Shoot",
  video_shoot: "Video Shoot",
};

// Screen 8 — Review queue: clear the day's submissions in five minutes.
export default function ReviewQueue() {
  // Local mock state: decisions made this session.
  const [decided, setDecided] = useState<Record<string, "approved" | "changes">>({});
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");
  const [changesTarget, setChangesTarget] = useState<Deliverable | null>(null);
  const [changesOpen, { open: openChanges, close: closeChanges }] =
    useDisclosure(false);

  const queue = useMemo(
    () =>
      deliverables
        .filter((d) => d.status === "pending" && !decided[d.id])
        .filter((d) => !creatorFilter || d.creatorId === creatorFilter)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [decided, creatorFilter]
  );

  const approve = (d: Deliverable) => {
    setDecided((m) => ({ ...m, [d.id]: "approved" }));
    notifications.show({
      title: "Approved",
      message: `${creatorById(d.creatorId)?.name}'s ${typeLabel[d.type].toLowerCase()} counts toward this month's KPIs.`,
      color: "green",
    });
  };

  const askChanges = (d: Deliverable) => {
    setChangesTarget(d);
    setComment("");
    openChanges();
  };

  const confirmChanges = () => {
    if (changesTarget) {
      setDecided((m) => ({ ...m, [changesTarget.id]: "changes" }));
      notifications.show({
        title: "Changes requested",
        message: "The creator sees your comment immediately.",
        color: "orange",
      });
    }
    closeChanges();
  };

  // Selection clamps as the queue shrinks (approvals remove rows).
  const sel = Math.min(selected, Math.max(queue.length - 1, 0));

  // Keyboard shortcuts: J/K move, A approve, R request changes.
  useEffect(() => {
    if (changesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "j") setSelected(Math.min(sel + 1, queue.length - 1));
      if (e.key === "k") setSelected(Math.max(sel - 1, 0));
      if (e.key === "a" && queue[sel]) approve(queue[sel]);
      if (e.key === "r" && queue[sel]) askChanges(queue[sel]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, sel, changesOpen]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Review queue</Title>
          <Text size="sm" c="dimmed">
            {queue.length} awaiting review · newest first
          </Text>
        </div>
        <Group gap="xs" visibleFrom="sm">
          <Kbd>J</Kbd>/<Kbd>K</Kbd>
          <Text size="xs" c="dimmed">
            move
          </Text>
          <Kbd>A</Kbd>
          <Text size="xs" c="dimmed">
            approve
          </Text>
          <Kbd>R</Kbd>
          <Text size="xs" c="dimmed">
            request changes
          </Text>
        </Group>
      </Group>

      <Select
        placeholder="Filter by creator"
        clearable
        maw={280}
        data={creators
          .filter((c) => c.active)
          .map((c) => ({ value: c.id, label: c.name }))}
        value={creatorFilter}
        onChange={setCreatorFilter}
      />

      {queue.length === 0 ? (
        <Alert variant="light" color="green">
          Queue is clear — nothing waiting for review.
        </Alert>
      ) : (
        <Stack gap="xs">
          {queue.map((d, i) => {
            const creator = creatorById(d.creatorId)!;
            const agent = d.agentId ? agentById(d.agentId) : null;
            const isSelected = i === sel;
            return (
              <Card
                key={d.id}
                padding="sm"
                onClick={() => setSelected(i)}
                style={{
                  cursor: "pointer",
                  borderColor: isSelected
                    ? "var(--mantine-color-brand-6)"
                    : undefined,
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Badge variant="light" size="sm" miw={72}>
                      {typeLabel[d.type]}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>
                        {creator.name}
                        {agent ? ` · for ${agent.name}` : ""}
                      </Text>
                      <Text size="xs" c="dimmed">
                        submitted {dayjs(d.submittedAt).format("ddd D MMM HH:mm")}
                        {d.posted ? " · posted" : ""}
                      </Text>
                    </div>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Tooltip label="Open in new tab">
                      <ActionIcon
                        variant="default"
                        component="a"
                        href={d.url}
                        target="_blank"
                        aria-label="Open deliverable"
                      >
                        <IconExternalLink size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Button
                      size="xs"
                      color="green"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => approve(d)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<IconMessage size={14} />}
                      onClick={() => askChanges(d)}
                    >
                      Request changes
                    </Button>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      <Modal
        opened={changesOpen}
        onClose={closeChanges}
        title="Request changes"
        centered
      >
        <Stack gap="md">
          <Textarea
            label="Comment for the creator"
            required
            placeholder="What needs to change?"
            autosize
            minRows={2}
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeChanges}>
              Cancel
            </Button>
            <Button
              color="orange"
              disabled={comment.trim() === ""}
              onClick={confirmChanges}
            >
              Send to creator
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
