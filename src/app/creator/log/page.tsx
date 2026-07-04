"use client";

// Screen 6 — Log a deliverable, on real data: recent shoots from the API,
// submission goes straight into the manager's review queue.

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconBrandDropbox,
  IconBrandGoogleDrive,
  IconBrandInstagram,
  IconBrandTiktok,
  IconLink,
} from "@tabler/icons-react";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";
import { AgentSearchSelect, type AgentHit } from "@/components/AgentSearchSelect";

type Platform = "instagram" | "tiktok" | "drive" | "dropbox" | "other";

function detectPlatform(url: string): Platform | null {
  if (!/^https?:\/\//i.test(url)) return null;
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/(drive|docs)\.google\.com/i.test(url)) return "drive";
  if (/dropbox\.com/i.test(url)) return "dropbox";
  return "other";
}

const platformMeta: Record<Platform, { label: string; icon: typeof IconLink }> = {
  instagram: { label: "Instagram", icon: IconBrandInstagram },
  tiktok: { label: "TikTok", icon: IconBrandTiktok },
  drive: { label: "Google Drive", icon: IconBrandGoogleDrive },
  dropbox: { label: "Dropbox", icon: IconBrandDropbox },
  other: { label: "Link", icon: IconLink },
};

type RecentShoot = {
  id: string;
  start: string;
  shootType: DbShootType;
  projectName: string | null;
  agentName: string | null;
  status: string;
};

export default function LogDeliverable() {
  const [recent, setRecent] = useState<RecentShoot[] | null>(null);
  const [shootId, setShootId] = useState<string | null>(null);
  const [noShoot, setNoShoot] = useState(false);
  const [agent, setAgent] = useState<AgentHit | null>(null);
  const [type, setType] = useState("photo_shoot");
  const [url, setUrl] = useState("");
  const [posted, setPosted] = useState(false);
  const [workDate, setWorkDate] = useState<string | null>(
    dayjs().format("YYYY-MM-DD")
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/me/bookings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: RecentShoot[]) =>
        setRecent(
          rows
            .filter(
              (b) =>
                ["completed", "confirmed"].includes(b.status) &&
                dayjs(b.start).isBefore(dayjs())
            )
            .sort((a, b) => b.start.localeCompare(a.start))
            .slice(0, 6)
        )
      )
      .catch(() => setRecent([]));
  }, []);

  const platform = useMemo(() => detectPlatform(url), [url]);
  const PlatformIcon = platform ? platformMeta[platform].icon : IconLink;
  const shootOk = noShoot ? agent !== null : shootId !== null;
  const canSubmit = shootOk && platform !== null && !!workDate;

  const submit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/me/deliverables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: noShoot ? undefined : shootId,
        agentId: noShoot ? agent?.id : undefined,
        type,
        url,
        platform,
        posted,
        workDate,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      notifications.show({
        title: "Couldn't submit",
        message: b.error ?? "Check the link and try again.",
        color: "red",
      });
      return;
    }
    notifications.show({
      title: "Deliverable submitted",
      message: "It's in the manager's review queue.",
      color: "green",
    });
    setShootId(null);
    setNoShoot(false);
    setAgent(null);
    setType("photo_shoot");
    setUrl("");
    setPosted(false);
    setWorkDate(dayjs().format("YYYY-MM-DD"));
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Log a deliverable</Title>
        <Text size="sm" c="dimmed">
          Takes less than a minute — it goes straight to review.
        </Text>
      </div>

      <div>
        <Text size="sm" fw={500} mb={6}>
          Which shoot is this from?
        </Text>
        {recent === null ? (
          <Skeleton height={120} radius="lg" />
        ) : (
          <Stack gap="xs">
            {recent.map((b) => {
              const selected = shootId === b.id && !noShoot;
              return (
                <UnstyledButton
                  key={b.id}
                  onClick={() => {
                    setShootId(b.id);
                    setNoShoot(false);
                  }}
                >
                  <Card
                    padding="sm"
                    style={
                      selected
                        ? { borderColor: "var(--mantine-color-brand-6)" }
                        : undefined
                    }
                    bg={selected ? "var(--mantine-color-brand-0)" : undefined}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text size="sm" fw={600}>
                          {dayjs(b.start).format("ddd D MMM, HH:mm")} ·{" "}
                          {dbShootTypeLabel[b.shootType]}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {b.projectName} · {b.agentName}
                        </Text>
                      </div>
                      {selected && <Badge size="sm">Selected</Badge>}
                    </Group>
                  </Card>
                </UnstyledButton>
              );
            })}

            <UnstyledButton
              onClick={() => {
                setNoShoot(true);
                setShootId(null);
              }}
            >
              <Card
                padding="sm"
                style={{
                  borderStyle: "dashed",
                  ...(noShoot
                    ? { borderColor: "var(--mantine-color-brand-6)" }
                    : {}),
                }}
                bg={noShoot ? "var(--mantine-color-brand-0)" : undefined}
              >
                <Group justify="space-between">
                  <Text size="sm">Not tied to a shoot</Text>
                  {noShoot && <Badge size="sm">Selected</Badge>}
                </Group>
              </Card>
            </UnstyledButton>

            {noShoot && (
              <AgentSearchSelect
                placeholder="Search the agent it's for"
                value={agent}
                onChange={setAgent}
              />
            )}
          </Stack>
        )}
      </div>

      <div>
        <Text size="sm" fw={500} mb={6}>
          Type
        </Text>
        <SegmentedControl
          fullWidth
          value={type}
          onChange={setType}
          data={[
            { label: "Photo Shoot", value: "photo_shoot" },
            { label: "Video Shoot", value: "video_shoot" },
          ]}
        />
      </div>

      <TextInput
        label="Link"
        placeholder="Paste the Instagram / TikTok / Drive / Dropbox link"
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        leftSection={<PlatformIcon size={18} />}
        rightSection={
          platform && (
            <Badge size="xs" variant="light" mr="md">
              {platformMeta[platform].label}
            </Badge>
          )
        }
        rightSectionWidth={platform ? 110 : undefined}
      />

      <Group grow align="center">
        <DatePickerInput
          label="Work date"
          value={workDate}
          onChange={setWorkDate}
          maxDate={dayjs().format("YYYY-MM-DD")}
        />
        <Switch
          label="Already posted?"
          checked={posted}
          onChange={(e) => setPosted(e.currentTarget.checked)}
          mt={22}
        />
      </Group>

      <Button size="md" disabled={!canSubmit} loading={submitting} onClick={submit}>
        Submit for review
      </Button>
    </Stack>
  );
}
