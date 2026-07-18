"use client";

// Screen 7 — My progress, on live KPIs (approved-only counting, decision #10).

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import { IconAlertTriangle, IconRefresh, IconVideo } from "@tabler/icons-react";

type MyKpis = {
  completed: number;
  approved: number;
  submitted: number;
  posted: number;
  overtimeMinutes: number;
  targetShoots: number;
  targetDeliverables: number;
  targetPosted: number;
};
type ToPost = {
  id: string;
  type: "photo_shoot" | "video_shoot";
  url: string;
  workDate: string;
};
type Revision = {
  id: string;
  type: "photo_shoot" | "video_shoot";
  url: string;
  comment: string | null;
};
type Outstanding = {
  id: string;
  start: string;
  projectName: string | null;
  agentName: string | null;
  expectedVideos: number;
  submittedVideos: number;
};

// Mirror the server's URL rule so a scheme-less paste (e.g. "www.…") is caught
// here with a clear hint, instead of failing submission with a vague error.
function isValidLink(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

export default function MyProgress() {
  const [data, setData] = useState<{
    kpis: MyKpis | null;
    revisions: Revision[];
    toPost: ToPost[];
    outstanding: Outstanding[];
  } | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  // Resubmit dialog: correct the link + acknowledge the comment first.
  const [resubmitTarget, setResubmitTarget] = useState<Revision | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [ack, setAck] = useState(false);
  const [resubmitOpen, { open: openResubmit, close: closeResubmit }] =
    useDisclosure(false);

  const reload = useCallback(() => {
    fetch("/api/me/kpis")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() =>
        notifications.show({
          title: "Couldn't load progress",
          message: "Try refreshing.",
          color: "red",
        })
      );
  }, []);
  useEffect(reload, [reload]);

  const markPosted = async (id: string) => {
    setActing(id);
    const res = await fetch(`/api/me/deliverables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_posted" }),
    });
    setActing(null);
    if (res.ok) {
      notifications.show({
        title: "Marked as posted",
        message: "Counted toward your posted KPI.",
        color: "green",
      });
      reload();
    }
  };

  const startResubmit = (d: Revision) => {
    setResubmitTarget(d);
    setNewUrl(d.url);
    setAck(false);
    openResubmit();
  };

  const confirmResubmit = async () => {
    if (!resubmitTarget) return;
    setActing(resubmitTarget.id);
    const changed = newUrl.trim() && newUrl.trim() !== resubmitTarget.url;
    const res = await fetch(`/api/me/deliverables/${resubmitTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resubmit",
        ...(changed ? { url: newUrl.trim() } : {}),
      }),
    });
    setActing(null);
    closeResubmit();
    const body = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? {
            title: "Resubmitted",
            message: "Back in the manager's review queue.",
            color: "green",
          }
        : {
            title: "Couldn't resubmit",
            message: body.error ?? "Check the link and try again.",
            color: "red",
          }
    );
    if (res.ok) reload();
  };

  if (data === null) {
    return (
      <Stack gap="md">
        <Skeleton height={32} width={160} />
        <Skeleton height={110} radius="lg" />
        <Skeleton height={110} radius="lg" />
      </Stack>
    );
  }

  const k = data.kpis;
  const stats = [
    {
      label: "Shoots completed",
      value: k?.completed ?? 0,
      target: k?.targetShoots ?? 0,
      hint: (k?.overtimeMinutes ?? 0) > 0 ? `${k!.overtimeMinutes}m overtime recorded` : null,
    },
    {
      label: "Deliverables approved",
      value: k?.approved ?? 0,
      target: k?.targetDeliverables ?? 0,
      hint:
        (k?.submitted ?? 0) - (k?.approved ?? 0) > 0
          ? `${k!.submitted - k!.approved} awaiting review`
          : null,
    },
    { label: "Posted", value: k?.posted ?? 0, target: k?.targetPosted ?? 0, hint: null },
  ];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>My progress</Title>
        <Text size="sm" c="dimmed">
          {dayjs().format("MMMM YYYY")}
        </Text>
      </div>

      {data.revisions.map((d) => (
        <Card key={d.id} style={{ borderColor: "var(--mantine-color-orange-4)" }}>
          <Stack gap="xs">
            <Group gap="xs">
              <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
              <Text fw={600} size="sm">
                Revision requested
              </Text>
              <Badge size="sm" color="orange" variant="light">
                {d.type === "photo_shoot" ? "Photo Shoot" : "Video Shoot"}
              </Badge>
            </Group>
            {d.comment && (
              <Text size="sm" c="dimmed">
                “{d.comment}”
              </Text>
            )}
            <Group justify="space-between">
              <Anchor size="xs" href={d.url} target="_blank">
                Open deliverable
              </Anchor>
              <Button
                size="xs"
                color="orange"
                leftSection={<IconRefresh size={14} />}
                onClick={() => startResubmit(d)}
              >
                Fix &amp; resubmit
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}

      {data.outstanding.length > 0 && (
        <Card style={{ borderColor: "var(--mantine-color-blue-3)" }}>
          <Stack gap="xs">
            <Group gap="xs">
              <IconVideo size={18} color="var(--mantine-color-blue-6)" />
              <Text fw={600} size="sm">
                Still to submit
              </Text>
            </Group>
            {data.outstanding.map((s) => (
              <Group key={s.id} justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {s.projectName ?? "Shoot"}
                    {s.agentName ? ` · ${s.agentName}` : ""}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {dayjs(s.start).format("ddd D MMM")} · {s.submittedVideos} of{" "}
                    {s.expectedVideos} videos submitted
                  </Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <Badge size="sm" color="orange" variant="light">
                    {s.expectedVideos - s.submittedVideos} left
                  </Badge>
                  <Button
                    size="compact-xs"
                    variant="light"
                    component={Link}
                    href="/creator/log"
                  >
                    Add
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {data.toPost.length > 0 && (
        <Card>
          <Stack gap="xs">
            <Text fw={600} size="sm">
              Approved — ready to post ({data.toPost.length})
            </Text>
            {data.toPost.map((d) => (
              <Group key={d.id} justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge size="sm" variant="light" color="green">
                    {d.type === "photo_shoot" ? "Photo Shoot" : "Video Shoot"}
                  </Badge>
                  <Anchor size="xs" href={d.url} target="_blank" truncate>
                    {d.url}
                  </Anchor>
                </Group>
                <Button
                  size="compact-xs"
                  loading={acting === d.id}
                  onClick={() => markPosted(d.id)}
                >
                  Mark as posted
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        {stats.map((s) => {
          const pct =
            s.target > 0 ? Math.min(100, Math.round((s.value / s.target) * 100)) : 0;
          return (
            <Card key={s.label}>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  {s.label}
                </Text>
                <Group align="baseline" gap={6}>
                  <Text fz={28} fw={700} lh={1}>
                    {s.value}
                  </Text>
                  <Text size="sm" c="dimmed">
                    / {s.target || "—"}
                  </Text>
                </Group>
                <Progress value={pct} color={pct >= 100 ? "green" : "brand"} size="sm" />
                <Text size="xs" c="dimmed">
                  {s.target > 0 ? `${pct}% of monthly target` : "No target set"}
                  {s.hint ? ` · ${s.hint}` : ""}
                </Text>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>

      {data.revisions.length === 0 && (
        <Alert variant="light" color="green">
          Nothing waiting on you — approved work counts the moment the manager
          approves it.
        </Alert>
      )}

      <Modal
        opened={resubmitOpen}
        onClose={closeResubmit}
        title="Fix & resubmit"
        centered
      >
        {resubmitTarget && (
          <Stack gap="md">
            <Alert variant="light" color="orange" icon={<IconAlertTriangle size={18} />}>
              <Text size="sm" fw={500} mb={4}>
                What the manager asked for:
              </Text>
              <Text size="sm">
                {resubmitTarget.comment ?? "No comment left."}
              </Text>
            </Alert>
            <TextInput
              label="Corrected link"
              description="Paste the fixed version, or leave as-is if you re-exported to the same link."
              value={newUrl}
              onChange={(e) => setNewUrl(e.currentTarget.value)}
              error={
                newUrl.trim() !== "" && !isValidLink(newUrl.trim())
                  ? "Enter a full link starting with https://"
                  : undefined
              }
            />
            <Checkbox
              checked={ack}
              onChange={(e) => setAck(e.currentTarget.checked)}
              label="I've addressed the manager's comment"
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeResubmit}>
                Cancel
              </Button>
              <Button
                color="orange"
                disabled={!ack || !isValidLink(newUrl.trim())}
                loading={acting === resubmitTarget.id}
                onClick={confirmResubmit}
              >
                Resubmit for review
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
