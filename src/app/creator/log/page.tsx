"use client";

// Screen 6 — Log a deliverable, on real data: recent shoots from the API,
// submission goes straight into the manager's review queue.

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ActionIcon,
  Anchor,
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
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconBrandDropbox,
  IconInfoCircle,
  IconPlus,
  IconX,
  IconBrandGoogleDrive,
  IconBrandInstagram,
  IconBrandTiktok,
  IconLink,
  IconSearch,
} from "@tabler/icons-react";
import { dbShootTypeLabel, type DbShootType } from "@/lib/shoot-types";

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
  const [title, setTitle] = useState("");
  const [type, setType] = useState("photo_shoot");
  const [links, setLinks] = useState<string[]>([""]);
  // Kept index-aligned with links — each video carries its own permit number.
  const [permits, setPermits] = useState<string[]>([""]);
  const [expectedVideos, setExpectedVideos] = useState<number | string>("");
  // Photo volume: a photo shoot is one folder link, so the count is what makes
  // the work measurable at all.
  const [imageCount, setImageCount] = useState<number | string>("");
  const [editExpected, setEditExpected] = useState(false);
  const [workDate, setWorkDate] = useState<string | null>(
    dayjs().format("YYYY-MM-DD")
  );
  const [submitting, setSubmitting] = useState(false);
  // The list can run to 25+ once shoots stay selectable until something is
  // logged, so it's searchable rather than truncated to the newest few.
  const [shootQuery, setShootQuery] = useState("");
  const [showAllShoots, setShowAllShoots] = useState(false);

  const loadRecent = useCallback(() => {
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
        )
      )
      .catch(() => setRecent([]));
  }, []);
  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const VISIBLE_SHOOTS = 6;
  const matchingShoots = useMemo(() => {
    const all = recent ?? [];
    const q = shootQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((b) =>
      [b.projectName, b.agentName, dayjs(b.start).format("D MMM YYYY ddd")]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [recent, shootQuery]);
  const shownShoots =
    showAllShoots || shootQuery.trim()
      ? matchingShoots
      : matchingShoots.slice(0, VISIBLE_SHOOTS);

  const platforms = useMemo(() => links.map(detectPlatform), [links]);
  const shootOk = noShoot ? title.trim() !== "" : shootId !== null;
  const selectedShoot = shootId
    ? recent?.find((s) => s.id === shootId) ?? null
    : null;
  // A shoot-tied video needs a declared total; it's asked once (when the shoot
  // has none yet) and read-only thereafter.
  const needsCount = type === "video_shoot" && !noShoot && !!shootId;
  const alreadyDeclared = selectedShoot?.expectedVideos != null;
  const countOk =
    !needsCount || (expectedVideos !== "" && Number(expectedVideos) >= 1);
  // Not tied to a shoot → a title is required to identify it in review.
  const titleOk = !noShoot || title.trim() !== "";
  // Every video needs its own permit number before it can be submitted.
  const permitsOk =
    type !== "video_shoot" ||
    links.every((_, i) => (permits[i] ?? "").trim() !== "");
  // Photos are one folder, so one count covers the submission.
  const imageCountOk =
    type !== "photo_shoot" || (imageCount !== "" && Number(imageCount) >= 0);
  const canSubmit =
    shootOk &&
    !!workDate &&
    links.length > 0 &&
    platforms.every((pf) => pf !== null) &&
    countOk &&
    titleOk &&
    permitsOk &&
    imageCountOk;

  const submit = async () => {
    setSubmitting(true);
    // One deliverable per link — each reviewed and counted individually.
    let ok = 0;
    // A company shoot is one shoot, however many links it produced — the first
    // submission creates the booking and the rest join it.
    let companyBookingId: string | null = null;
    for (let i = 0; i < links.length; i++) {
      const res = await fetch("/api/me/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: noShoot ? (companyBookingId ?? undefined) : shootId,
          companyShoot: noShoot && !companyBookingId ? true : undefined,
          title: noShoot ? title.trim() : undefined,
          type,
          url: links[i],
          platform: platforms[i],
          workDate,
          permitNumber:
            type === "video_shoot" ? (permits[i] ?? "").trim() : undefined,
          imageCount:
            type === "photo_shoot" && imageCount !== ""
              ? Number(imageCount)
              : undefined,
          expectedVideos:
            type === "video_shoot" && !noShoot && expectedVideos !== ""
              ? Number(expectedVideos)
              : undefined,
        }),
      });
      if (res.ok) {
        ok++;
        if (noShoot && !companyBookingId) {
          const body: { bookingId?: string | null } = await res
            .json()
            .catch(() => ({}));
          companyBookingId = body.bookingId ?? null;
        }
      }
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
    setTitle("");
    setType("photo_shoot");
    setLinks([""]);
    setPermits([""]);
    setExpectedVideos("");
    setImageCount("");
    setEditExpected(false);
    setWorkDate(dayjs().format("YYYY-MM-DD"));
    // Refresh so the just-set total and counts are current if they log another.
    loadRecent();
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
            {recent.length > VISIBLE_SHOOTS && (
              <TextInput
                placeholder="Search by project, agent or date"
                value={shootQuery}
                onChange={(e) => setShootQuery(e.currentTarget.value)}
                leftSection={<IconSearch size={16} />}
              />
            )}
            {shownShoots.length === 0 && (
              <Text size="sm" c="dimmed">
                No shoots match “{shootQuery}”.
              </Text>
            )}
            {shownShoots.map((b) => {
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
                    setEditExpected(false);
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

            {!shootQuery.trim() &&
              !showAllShoots &&
              matchingShoots.length > VISIBLE_SHOOTS && (
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  onClick={() => setShowAllShoots(true)}
                >
                  Show {matchingShoots.length - VISIBLE_SHOOTS} older shoots
                </Anchor>
              )}

            <UnstyledButton
              onClick={() => {
                setNoShoot(true);
                setShootId(null);
                setExpectedVideos("");
                setEditExpected(false);
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
                  <div>
                    <Text size="sm">Company shoot</Text>
                    <Text size="xs" c="dimmed">
                      Internal work with no agent — meetings, activations,
                      social posts
                    </Text>
                  </div>
                  {noShoot && <Badge size="sm">Selected</Badge>}
                </Group>
              </Card>
            </UnstyledButton>

            {noShoot && (
              <TextInput
                label="What was it for?"
                description="Names the shoot in review and on the KPI screens."
                placeholder="e.g. Monday meeting, Q3 activation"
                required
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
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
            if (v === "photo_shoot") {
              setLinks((l) => [l[0] ?? ""]);
              setPermits((p) => [p[0] ?? ""]);
            }
          }}
          data={[
            { label: "Photo Shoot", value: "photo_shoot" },
            { label: "Video Shoot", value: "video_shoot" },
          ]}
        />
      </div>

      {needsCount &&
        (alreadyDeclared && !editExpected ? (
          // Declared once already — just show it, don't ask again.
          <Group gap="xs">
            <Text size="sm">
              This shoot:{" "}
              <Text span fw={600}>
                {selectedShoot?.expectedVideos} videos
              </Text>
            </Text>
            <Anchor
              component="button"
              type="button"
              size="sm"
              onClick={() => setEditExpected(true)}
            >
              Edit
            </Anchor>
          </Group>
        ) : (
          <NumberInput
            label={
              <Group gap={4} align="center" wrap="nowrap" component="span">
                <span>How many videos total from this shoot?</span>
                <Tooltip
                  multiline
                  w={240}
                  withArrow
                  label="Set this once for the shoot so you and the manager can see what's still outstanding. You can send the rest later."
                >
                  <IconInfoCircle
                    size={14}
                    style={{ color: "var(--mantine-color-dimmed)", cursor: "help" }}
                  />
                </Tooltip>
              </Group>
            }
            required
            min={1}
            max={20}
            value={expectedVideos}
            onChange={setExpectedVideos}
          />
        ))}

      {type === "photo_shoot" && (
        <NumberInput
          label={
            <Group gap={4} align="center" wrap="nowrap" component="span">
              <span>How many images are in this folder?</span>
              <Tooltip
                multiline
                w={240}
                withArrow
                label="A photo shoot is logged as one folder, so this is what makes the size of the job visible — it's what your photo target is measured against."
              >
                <IconInfoCircle
                  size={14}
                  style={{ color: "var(--mantine-color-dimmed)", cursor: "help" }}
                />
              </Tooltip>
            </Group>
          }
          required
          min={0}
          max={10000}
          value={imageCount}
          onChange={setImageCount}
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
              <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
                <Stack gap={4} style={{ flex: 1 }}>
                  <TextInput
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
                  {type === "video_shoot" && (
                    <TextInput
                      placeholder="Permit number for this video"
                      value={permits[i] ?? ""}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        setPermits((p) => {
                          const next = [...p];
                          next[i] = v;
                          return next;
                        });
                      }}
                    />
                  )}
                </Stack>
                {links.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Remove link"
                    onClick={() => {
                      setLinks((l) => l.filter((_, j) => j !== i));
                      setPermits((p) => p.filter((_, j) => j !== i));
                    }}
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
              onClick={() => {
                setLinks((l) => [...l, ""]);
                setPermits((p) => [...p, ""]);
              }}
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
