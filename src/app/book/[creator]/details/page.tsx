"use client";

import { Suspense, useState } from "react";
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
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCalendarEvent, IconInfoCircle } from "@tabler/icons-react";
import { dbShootTypeLabel, isDbShootType } from "@/lib/shoot-types";
import { useCreatorProfile } from "@/lib/use-creator";
import { AgentSearchSelect, type AgentHit } from "@/components/AgentSearchSelect";
import { ShootingGuidelines } from "@/components/ShootingGuidelines";

// Screen 3 — Booking details: one screen, under two minutes.
function BookingDetails() {
  const { creator: slug } = useParams<{ creator: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { creator, state } = useCreatorProfile(slug);

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const typeParam = searchParams.get("type") ?? "";
  const shootType = isDbShootType(typeParam) ? typeParam : null;
  const rescheduleId = searchParams.get("reschedule");

  const [agent, setAgent] = useState<AgentHit | null>(null);
  const [registering, setRegistering] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", office: "", email: "", phone: "" });
  const [projectName, setProjectName] = useState("");
  const [locationKind, setLocationKind] = useState<"onsite" | "office">("onsite");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (state === "loading") {
    return (
      <Stack gap="md">
        <Skeleton height={28} width={200} />
        <Skeleton height={72} radius="lg" />
        <Skeleton height={420} radius="lg" />
      </Stack>
    );
  }

  if (!creator || !start || !end || !shootType) {
    return (
      <Alert color="red" variant="light">
        Missing booking details — start again from the booking page.
      </Alert>
    );
  }

  const slot = dayjs(start);
  const slotEnd = dayjs(end);

  const agentOk = registering
    ? newAgent.name.trim() !== "" && newAgent.email.trim() !== ""
    : agent !== null;
  const locationOk = locationKind === "office" || address.trim() !== "";
  const canSubmit = agentOk && locationOk && projectName.trim() !== "";

  const submit = async () => {
    setSubmitting(true);
    let agentId = agent?.id ?? null;
    let agentName = agent?.name ?? "";

    if (registering) {
      // Real self-registration: lands in the manager's approval inbox.
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newAgent.name,
          email: newAgent.email,
          phone: newAgent.phone || undefined,
          office: newAgent.office || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        notifications.show({
          title: "Registration failed",
          message: body.error ?? "Please check your details and try again.",
          color: "red",
        });
        setSubmitting(false);
        return;
      }
      const created = await res.json();
      agentId = created.id;
      agentName = newAgent.name;
    }

    // The real booking: server re-validates the slot, writes the calendar
    // event, and emails the invite. 409 = someone took the slot first.
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorSlug: creator.slug,
        shootType,
        start: slot.toISOString(),
        agentId,
        projectName,
        locationType: locationKind === "onsite" ? "on_site" : "office",
        propertyAddress: locationKind === "onsite" ? address : undefined,
        notes: notes.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        notifications.show({
          title: "Slot no longer available",
          message: body.error ?? "Someone just booked this time — please pick another slot.",
          color: "orange",
        });
        router.push(`/book/${creator.slug}`);
      } else {
        notifications.show({
          title: "Booking failed",
          message: body.error ?? "Please try again.",
          color: "red",
        });
        setSubmitting(false);
      }
      return;
    }

    const booking = await res.json();
    const params = new URLSearchParams({
      start: booking.start,
      end: booking.end,
      type: shootType,
      agent: agentName,
      project: projectName,
      location: locationKind === "onsite" ? address : "Office",
      manage: booking.manageUrl,
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
              {slot.format("h:mm A")}–{slotEnd.format("h:mm A")} ·{" "}
              {dbShootTypeLabel[shootType]}
            </Text>
          </div>
        </Group>
      </Paper>

      <ShootingGuidelines variant="accordion" />

      <Card>
        <Stack gap="md">
          {!registering ? (
            <Stack gap={6}>
              <AgentSearchSelect
                label="Your name"
                value={agent}
                onChange={setAgent}
                description="Searches the full agent list"
              />
              <Anchor
                size="xs"
                component="button"
                type="button"
                onClick={() => setRegistering(true)}
              >
                Can&apos;t find your name?
              </Anchor>
              {agent && (
                <Group grow>
                  <TextInput
                    label="Email"
                    value={agent.email ?? ""}
                    readOnly
                    variant="filled"
                  />
                  <TextInput
                    label="Phone"
                    value={agent.phone ?? ""}
                    readOnly
                    variant="filled"
                  />
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

          <Button size="md" disabled={!canSubmit} loading={submitting} onClick={submit}>
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
