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
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  DeliverableEditModal,
  type EditableDeliverable,
} from "@/components/DeliverableEditModal";
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
  permitNumber: string | null;
  imageCount: number | null;
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
  const [editing, setEditing] = useState<EditableDeliverable | null>(null);
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
      opts?: { comment?: string }
    ) => {
      setBusy(true);
      const res = await fetch(`/api/admin/deliverables/${d.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve" ? { action } : { action, comment: opts?.comment }
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

  // Approving is irreversible from this screen and used to fire on a single
  // click or keypress, which made mis-approvals easy. The confirm step also
  // shows what's being signed off — permit or image count — so it's a check,
  // not just a speed bump.
  const startApprove = useCallback(
    (d: QueueItem) => {
      setApproveTarget(d);
      openApprove();
    },
    [openApprove]
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
                    {d.type === "video_shoot" && (
                      <Text size="xs" c={d.permitNumber ? undefined : "orange"}>
                        {d.permitNumber
                          ? `Permit ${d.permitNumber}`
                          : "No permit supplied"}
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
                  {/* A wrong link or permit is faster to fix here than to send
                      back and wait for a resubmission. */}
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() =>
                      setEditing({
                        id: d.id,
                        type: d.type,
                        url: d.url,
                        title: d.title,
                        permitNumber: d.permitNumber,
                        imageCount: d.imageCount,
                        creatorName: d.creatorName,
                      })
                    }
                  >
                    Edit
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={approveOpen}
        onClose={closeApprove}
        title="Approve this deliverable?"
        centered
      >
        {approveTarget && (
          <Stack gap="md">
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                {approveTarget.creatorName} · {typeLabel[approveTarget.type]}
              </Text>
              {(approveTarget.projectName ?? approveTarget.title) && (
                <Text size="sm">
                  {approveTarget.projectName ?? approveTarget.title}
                </Text>
              )}
              {approveTarget.type === "video_shoot" && (
                <Text size="sm" c={approveTarget.permitNumber ? undefined : "orange"}>
                  {approveTarget.permitNumber
                    ? `Permit ${approveTarget.permitNumber}`
                    : "No permit supplied"}
                </Text>
              )}
              {approveTarget.type === "photo_shoot" && (
                <Text size="sm" c={approveTarget.imageCount == null ? "orange" : undefined}>
                  {approveTarget.imageCount == null
                    ? "No image count supplied"
                    : `${approveTarget.imageCount} images`}
                </Text>
              )}
            </Stack>
            <Text size="xs" c="dimmed">
              Approving counts it toward this month&apos;s KPIs. Undoing it
              afterwards needs a manager to edit the record directly.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeApprove}>
                Cancel
              </Button>
              <Button
                color="green"
                leftSection={<IconCheck size={14} />}
                loading={busy}
                data-autofocus
                onClick={async () => {
                  await decide(approveTarget, "approve");
                  closeApprove();
                }}
              >
                Approve
              </Button>
            </Group>
          </Stack>
        )}
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
      <DeliverableEditModal
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />

    </Stack>
  );
}
