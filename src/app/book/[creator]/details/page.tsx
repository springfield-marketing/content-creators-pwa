"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Paper,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { IconCalendarEvent, IconInfoCircle } from "@tabler/icons-react";
import {
  agents,
  creatorBySlug,
  shootTypeLabel,
  type ShootType,
} from "@/lib/mock-data";

// Screen 3 — Booking details: one screen, five fields, under two minutes.
function BookingDetails() {
  const { creator: slug } = useParams<{ creator: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const creator = creatorBySlug(slug);

  const start = searchParams.get("start");
  const rescheduleId = searchParams.get("reschedule");

  const [agentId, setAgentId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", office: "", email: "", phone: "" });
  const [projectName, setProjectName] = useState("");
  const [shootType, setShootType] = useState<ShootType>("photo");
  const [locationKind, setLocationKind] = useState<"onsite" | "office">("onsite");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const agentOptions = useMemo(
    () =>
      agents
        .filter((a) => a.status === "active")
        .map((a) => ({ value: a.id, label: `${a.name} — ${a.office}` })),
    []
  );
  const selectedAgent = agents.find((a) => a.id === agentId);

  if (!creator || !start) {
    return (
      <Alert color="red" variant="light">
        Missing booking details — start again from the booking page.
      </Alert>
    );
  }

  const slot = dayjs(start);
  const duration =
    shootType === "video"
      ? creator.settings.videoDuration
      : creator.settings.photoDuration;

  const agentOk = registering
    ? newAgent.name.trim() !== "" && newAgent.email.trim() !== ""
    : agentId !== null;
  const locationOk = locationKind === "office" || address.trim() !== "";
  const canSubmit = agentOk && locationOk && projectName.trim() !== "";

  const submit = () => {
    const params = new URLSearchParams({
      start: slot.toISOString(),
      type: shootType,
      agent: registering ? `${newAgent.name} (new)` : (selectedAgent?.name ?? ""),
      project: projectName,
      location: locationKind === "onsite" ? address : "Office",
    });
    if (rescheduleId) params.set("reschedule", rescheduleId);
    router.push(`/book/${creator.slug}/confirmed?${params.toString()}`);
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Booking details</Title>

      <Paper withBorder p="md">
        <Group gap="sm">
          <IconCalendarEvent size={20} color="var(--mantine-color-brand-6)" />
          <div>
            <Text fw={600} size="sm">
              {creator.name} · {slot.format("dddd, MMMM D")}
            </Text>
            <Text size="sm" c="dimmed">
              {slot.format("HH:mm")}–{slot.add(duration, "minute").format("HH:mm")} (
              {shootTypeLabel[shootType]}, {duration} min)
            </Text>
          </div>
        </Group>
      </Paper>

      <Card>
        <Stack gap="md">
          {!registering ? (
            <Stack gap={6}>
              <Select
                label="Your name"
                placeholder="Type at least 3 letters to search"
                searchable
                clearable
                data={agentOptions}
                value={agentId}
                onChange={setAgentId}
                nothingFoundMessage="No matching agent"
                description="Searches the full agent list (200+)"
              />
              <Anchor
                size="xs"
                component="button"
                type="button"
                onClick={() => setRegistering(true)}
              >
                Can&apos;t find your name?
              </Anchor>
              {selectedAgent && (
                <Group grow>
                  <TextInput label="Email" value={selectedAgent.email} readOnly variant="filled" />
                  <TextInput label="Phone" value={selectedAgent.phone} readOnly variant="filled" />
                </Group>
              )}
            </Stack>
          ) : (
            <Stack gap="xs">
              <Alert variant="light" color="yellow" icon={<IconInfoCircle size={18} />} p="xs">
                New agents are flagged for manager approval.
              </Alert>
              <TextInput
                label="Full name"
                required
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.currentTarget.value })}
              />
              <TextInput
                label="Office"
                value={newAgent.office}
                onChange={(e) => setNewAgent({ ...newAgent, office: e.currentTarget.value })}
              />
              <Group grow>
                <TextInput
                  label="Email"
                  required
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.currentTarget.value })}
                />
                <TextInput
                  label="Phone"
                  value={newAgent.phone}
                  onChange={(e) => setNewAgent({ ...newAgent, phone: e.currentTarget.value })}
                />
              </Group>
              <Anchor size="xs" component="button" type="button" onClick={() => setRegistering(false)}>
                Back to name search
              </Anchor>
            </Stack>
          )}

          <TextInput
            label="Project name"
            required
            placeholder="What is the shoot about? e.g. 14 Maple Drive listing"
            value={projectName}
            onChange={(e) => setProjectName(e.currentTarget.value)}
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              Shoot type
            </Text>
            <SegmentedControl
              fullWidth
              value={shootType}
              onChange={(v) => setShootType(v as ShootType)}
              data={[
                { label: "Photo", value: "photo" },
                { label: "Video", value: "video" },
                { label: "Both", value: "both" },
              ]}
            />
          </div>

          <Radio.Group
            label="Location"
            value={locationKind}
            onChange={(v) => setLocationKind(v as "onsite" | "office")}
          >
            <Group mt={6}>
              <Radio value="onsite" label="On-site (property)" />
              <Radio value="office" label="Office" />
            </Group>
          </Radio.Group>
          {locationKind === "onsite" && (
            <TextInput
              label="Property address"
              required
              placeholder="Street, number, city"
              value={address}
              onChange={(e) => setAddress(e.currentTarget.value)}
            />
          )}

          <Textarea
            label="Notes for the creator"
            placeholder="Anything they should know — access, focus points, style…"
            autosize
            minRows={2}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />

          <Button size="md" disabled={!canSubmit} onClick={submit}>
            {rescheduleId ? "Confirm new time" : "Confirm booking"}
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

export default function Page() {
  return (
    <Suspense>
      <BookingDetails />
    </Suspense>
  );
}
