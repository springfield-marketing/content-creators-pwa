"use client";

// Screen 6 — Log a deliverable, on real data: recent shoots from the API,
// submission goes straight into the manager's review queue.

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconBrandDropbox,
  IconPlus,
  IconX,
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
  expectedVideos: number | null;
  submittedVideos: number;
};

export default function LogDeliverable() {
  const [recent, setRecent] = useState<RecentShoot[] | null>(null);
  const [shootId, setShootId] = useState<string | null>(null);
  const [noShoot, setNoShoot] = useState(false);
  const [agent, setAgent] = useState<AgentHit | null>(null);
  const [type, setType] = useState("photo_shoot");
  const [links, setLinks] = useState<string[]>([""]);
  const [expectedVideos, setExpectedVideos] = useState<number | string>("");
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
            // Shoots still owing videos float to the top so they stay easy to
            // find days later; otherwise newest first.
            .sort((a, b) => {
              const aOut = a.expectedVideos != null && a.submittedVideos < a.expectedVideos;
              const bOut = b.expectedVideos != null && b.submittedVideos < b.expectedVideos;
              if (aOut !== bOut) return aOut ? -1 : 1;
              return b.start.localeCompare(a.start);
            })
            .slice(0, 8)
        )
      )
      .catch(() => setRecent([]));
  }, []);

  const platforms = useMemo(() => links.map(detectPlatform), [links]);
  const shootOk = noShoot ? agent !== null : shootId !== null;
  const canSubmit =
    shootOk &&
    !!workDate &&
    links.length > 0 &&
    platforms.every((pf) => pf !== null);

  const submit = async () => {
    setSubmitting(true);
    // One deliverable per link — each reviewed and counted individually.
    let ok = 0;
    for (let i = 0; i < links.length; i++) {
      const res = await fetch("/api/me/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: noShoot ? undefined : shootId,
          agentId: noShoot ? agent?.id : undefined,
          type,
          url: links[i],
          platform: platforms[i],
          workDate,
          expectedVideos:
            type === "video_shoot" && !noShoot && expectedVideos !== ""
              ? Number(expectedVideos)
              : undefined,
        }),
      });
      if (res.ok) ok++;
    }
    setSubmitting(false);
    if (ok === 0) {
      notifications.show({
        title: "Couldn't submit",
        message: "Check the links and try again.",
        color: "red",
      });
      return;
    }
    notifications.show({
      title: ok === 1 ? "Deliverable submitted" : `${ok} deliverables submitted`,
      message:
        ok < links.length
          ? `${links.length - ok} failed — check those links and resubmit them.`
          : "In the manager's review queue. Mark them posted from Progress once approved.",
      color: ok < links.length ? "orange" : "green",
    });
    setShootId(null);
    setNoShoot(false);
    setAgent(null);
    setType("photo_shoot");
    setLinks([""]);
    setExpectedVideos("");
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
                    // Attribute the deliverable to the shoot's date, not today.
                    setWorkDate(dayjs(b.start).format("YYYY-MM-DD"));
                    setExpectedVideos(b.expectedVideos ?? "");
                    if (b.expectedVideos != null) setType("video_shoot");
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
                      <Group gap="xs" wrap="nowrap">
                        {b.expectedVideos != null && (
                          <Badge
                            size="sm"
                            variant="light"
                            color={
                              b.submittedVideos >= b.expectedVideos
                                ? "green"
                                : "orange"
                            }
                          >
                            {b.submittedVideos} of {b.expectedVideos} videos
                          </Badge>
                        )}
                        {selected && <Badge size="sm">Selected</Badge>}
                      </Group>
                    </Group>
                  </Card>
                </UnstyledButton>
              );
            })}

            <UnstyledButton
              onClick={() => {
                setNoShoot(true);
                setShootId(null);
                setExpectedVideos("");
                setWorkDate(dayjs().format("YYYY-MM-DD"));
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
          onChange={(v) => {
            setType(v);
            // Photos are one batch — a single folder link.
            if (v === "photo_shoot") setLinks((l) => [l[0] ?? ""]);
          }}
          data={[
            { label: "Photo Shoot", value: "photo_shoot" },
            { label: "Video Shoot", value: "video_shoot" },
          ]}
        />
      </div>

      {type === "video_shoot" && !noShoot && shootId && (
        <NumberInput
          label="How many videos total from this shoot?"
          description="Lets you and the manager see what's still outstanding — you can send the rest later and adjust this anytime."
          min={1}
          max={20}
          value={expectedVideos}
          onChange={setExpectedVideos}
          w={300}
        />
      )}

      <div>
        <Text size="sm" fw={500} mb={6}>
          {type === "photo_shoot" ? "Link (photo batch)" : "Links"}
        </Text>
        <Stack gap="xs">
          {links.map((url, i) => {
            const pf = platforms[i];
            const PlatformIcon = pf ? platformMeta[pf].icon : IconLink;
            return (
              <Group key={i} gap="xs" wrap="nowrap">
                <TextInput
                  style={{ flex: 1 }}
                  placeholder="Paste the Instagram / TikTok / Drive / Dropbox link"
                  value={url}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setLinks((l) => l.map((x, j) => (j === i ? v : x)));
                  }}
                  leftSection={<PlatformIcon size={18} />}
                  rightSection={
                    pf && (
                      <Badge size="xs" variant="light" mr="md">
                        {platformMeta[pf].label}
                      </Badge>
                    )
                  }
                  rightSectionWidth={pf ? 110 : undefined}
                />
                {links.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Remove link"
                    onClick={() =>
                      setLinks((l) => l.filter((_, j) => j !== i))
                    }
                  >
                    <IconX size={16} />
                  </ActionIcon>
                )}
              </Group>
            );
          })}
          {type === "video_shoot" && (
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setLinks((l) => [...l, ""])}
              w="fit-content"
            >
              Add another video
            </Button>
          )}
        </Stack>
      </div>

      <DatePickerInput
        label="Work date"
        value={workDate}
        onChange={setWorkDate}
        maxDate={dayjs().format("YYYY-MM-DD")}
      />

      <Button size="md" disabled={!canSubmit} loading={submitting} onClick={submit}>
        Submit for review
      </Button>
    </Stack>
  );
}
