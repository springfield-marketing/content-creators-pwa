"use client";

// Screen 8 — Review queue, on real data. J/K/A/R keyboard shortcuts.

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconExternalLink, IconMessage } from "@tabler/icons-react";

type QueueItem = {
  id: string;
  type: "photo_shoot" | "video_shoot" | "other";
  url: string;
  posted: boolean;
  submittedAt: string;
  creatorId: string;
  creatorName: string;
  agentName: string | null;
  projectName: string | null;
  title: string | null;
  expectedVideos: number | null;
  shootVideos: number;
};

const typeLabel: Record<string, string> = {
  photo_shoot: "Photo Shoot",
  video_shoot: "Video Shoot",
  other: "Other",
};

export default function ReviewQueue() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");
  const [changesTarget, setChangesTarget] = useState<QueueItem | null>(null);
  const [approveTarget, setApproveTarget] = useState<QueueItem | null>(null);
  const [permit, setPermit] = useState("");
  const [busy, setBusy] = useState(false);
  const [changesOpen, { open: openChanges, close: closeChanges }] =
    useDisclosure(false);
  const [approveOpen, { open: openApprove, close: closeApprove }] =
    useDisclosure(false);

  const reload = useCallback(() => {
    fetch("/api/admin/review-queue")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setItems)
      .catch(() =>
        notifications.show({
          title: "Couldn't load the queue",
          message: "Try refreshing.",
          color: "red",
        })
      );
  }, []);
  useEffect(reload, [reload]);

  const queue = useMemo(
    () =>
      (items ?? []).filter(
        (d) => !creatorFilter || d.creatorId === creatorFilter
      ),
    [items, creatorFilter]
  );
  const creators = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of items ?? []) seen.set(d.creatorId, d.creatorName);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [items]);

  const decide = useCallback(
    async (
      d: QueueItem,
      action: "approve" | "request_changes",
      opts?: { comment?: string; permitNumber?: string }
    ) => {
      setBusy(true);
      const res = await fetch(`/api/admin/deliverables/${d.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? {
                action,
                ...(opts?.permitNumber ? { permitNumber: opts.permitNumber } : {}),
              }
            : { action, comment: opts?.comment }
        ),
      });
      setBusy(false);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notifications.show({
          title: "Action failed",
          message: body.error ?? "Try again.",
          color: "red",
        });
        return;
      }
      notifications.show({
        title: action === "approve" ? "Approved" : "Changes requested",
        message:
          action === "approve"
            ? `${d.creatorName}'s ${typeLabel[d.type].toLowerCase()} counts toward this month's KPIs.`
            : "The creator sees your comment on their progress screen.",
        color: action === "approve" ? "green" : "orange",
      });
      setItems((cur) => (cur ?? []).filter((x) => x.id !== d.id));
    },
    []
  );

  const askChanges = useCallback(
    (d: QueueItem) => {
      setChangesTarget(d);
      setComment("");
      openChanges();
    },
    [openChanges]
  );

  // Videos need a permit number recorded, so approving one goes through a
  // popup; photos approve in one click as before.
  const startApprove = useCallback(
    (d: QueueItem) => {
      if (d.type === "video_shoot") {
        setApproveTarget(d);
        setPermit("");
        openApprove();
      } else {
        decide(d, "approve");
      }
    },
    [openApprove, decide]
  );

  const sel = Math.min(selected, Math.max(queue.length - 1, 0));

  useEffect(() => {
    if (changesOpen || approveOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "j") setSelected(Math.min(sel + 1, queue.length - 1));
      if (e.key === "k") setSelected(Math.max(sel - 1, 0));
      if (e.key === "a" && queue[sel]) startApprove(queue[sel]);
      if (e.key === "r" && queue[sel]) askChanges(queue[sel]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue, sel, changesOpen, approveOpen, startApprove, askChanges]);

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
        data={creators}
        value={creatorFilter}
        onChange={setCreatorFilter}
      />

      {items === null ? (
        <Skeleton height={260} radius="lg" />
      ) : queue.length === 0 ? (
        <Alert variant="light" color="green">
          Queue is clear — nothing waiting for review.
        </Alert>
      ) : (
        <Stack gap="xs">
          {queue.map((d, i) => (
            <Card
              key={d.id}
              padding="sm"
              onClick={() => setSelected(i)}
              style={{
                cursor: "pointer",
                borderColor: i === sel ? "var(--mantine-color-brand-6)" : undefined,
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge variant="light" size="sm" miw={100}>
                    {typeLabel[d.type]}
                  </Badge>
                  {d.type === "video_shoot" && d.expectedVideos != null && (
                    <Badge size="sm" variant="outline" color="gray">
                      {d.shootVideos} of {d.expectedVideos} in shoot
                    </Badge>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>
                      {d.creatorName}
                      {d.agentName ? ` · for ${d.agentName}` : ""}
                    </Text>
                    {(d.projectName ?? d.title) && (
                      <Text size="xs" fw={500} truncate>
                        {d.projectName ?? d.title}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      submitted {dayjs(d.submittedAt).format("ddd D MMM HH:mm")}
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
                    loading={busy}
                    onClick={() => startApprove(d)}
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
          ))}
        </Stack>
      )}

      <Modal opened={approveOpen} onClose={closeApprove} title="Approve video" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Record the permit number for {approveTarget?.creatorName}&apos;s video
            after checking it.
          </Text>
          <TextInput
            label="Permit number"
            required
            placeholder="e.g. 1234567890"
            value={permit}
            onChange={(e) => setPermit(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeApprove}>
              Cancel
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={14} />}
              disabled={permit.trim() === ""}
              loading={busy}
              onClick={async () => {
                if (approveTarget) {
                  await decide(approveTarget, "approve", {
                    permitNumber: permit.trim(),
                  });
                }
                closeApprove();
              }}
            >
              Approve
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={changesOpen} onClose={closeChanges} title="Request changes" centered>
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
              disabled={comment.trim().length < 3}
              loading={busy}
              onClick={async () => {
                if (changesTarget) {
                  await decide(changesTarget, "request_changes", { comment });
                }
                closeChanges();
              }}
            >
              Send to creator
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
