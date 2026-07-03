"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
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
import { agentById, agents, bookings, shootTypeLabel } from "@/lib/mock-data";

// Mock logged-in creator until auth lands.
const ME = "c1";

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

// Screen 6 — Log a deliverable: designed to take under 60 seconds.
export default function LogDeliverable() {
  const [shootId, setShootId] = useState<string | null>(null);
  const [noShoot, setNoShoot] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [type, setType] = useState("photo_shoot");
  const [url, setUrl] = useState("");
  const [posted, setPosted] = useState(false);
  const [workDate, setWorkDate] = useState<string | null>(
    dayjs().format("YYYY-MM-DD")
  );

  // The creator's own recent shoots, most recent first.
  const recentShoots = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            b.creatorId === ME &&
            ["completed", "confirmed"].includes(b.status) &&
            dayjs(b.start).isBefore(dayjs()) &&
            dayjs(b.start).isAfter(dayjs().subtract(7, "day"))
        )
        .sort((a, b) => b.start.localeCompare(a.start)),
    []
  );

  const platform = detectPlatform(url);
  const PlatformIcon = platform ? platformMeta[platform].icon : IconLink;
  const shootOk = noShoot || shootId !== null;
  const agentOk = !noShoot || agentId !== null;
  const canSubmit = shootOk && agentOk && platform !== null;

  const submit = () => {
    notifications.show({
      title: "Deliverable submitted",
      message: "It's in the manager's review queue.",
      color: "green",
    });
    setShootId(null);
    setNoShoot(false);
    setAgentId(null);
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
        <Stack gap="xs">
          {recentShoots.map((b) => {
            const agent = agentById(b.agentId)!;
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
                        {shootTypeLabel[b.shootType]}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {agent.name} —{" "}
                        {b.location.kind === "onsite"
                          ? b.location.address
                          : "Office"}
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
            <Select
              placeholder="Search the agent it's for"
              searchable
              clearable
              data={agents
                .filter((a) => a.status === "active")
                .map((a) => ({ value: a.id, label: `${a.name} — ${a.office}` }))}
              value={agentId}
              onChange={setAgentId}
              nothingFoundMessage="No matching agent"
            />
          )}
        </Stack>
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

      <Button size="md" disabled={!canSubmit} onClick={submit}>
        Submit for review
      </Button>
    </Stack>
  );
}
