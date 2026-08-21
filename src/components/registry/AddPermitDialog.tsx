"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Button,
  Divider,
  FileInput,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { defaultListingEnd } from "@/lib/registry/issue";
import type { PermitCategory } from "@/db/schema";

// Where the permit is issued. A fixed list rather than free text: it is one of
// seven, and the old sheet accumulated spellings of each.
const EMIRATES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
];

export type AddTarget = {
  /** An existing project to renew against, or null to add a new one. */
  projectId: number | null;
  projectName: string;
  category: PermitCategory;
  /** Closes the request this fulfils, if any. */
  requestId?: number;
};

/**
 * Add a permit of any kind, or renew an existing one.
 *
 * One dialog rather than one per category: they are one table and one thing a
 * person sets out to do ("add a permit"), and the category decides which
 * fields apply rather than which button to press.
 */
export function AddPermitDialog({
  target,
  projects,
  onClose,
}: {
  target: AddTarget | null;
  /** Existing projects, so a renewal attaches rather than duplicating. */
  projects: { id: number; name: string }[];
  onClose: () => void;
}) {
  return (
    <Modal
      opened={!!target}
      onClose={onClose}
      title={
        target?.projectId
          ? `Renew — ${target.projectName}`
          : target?.category === "general"
            ? "Add general permit"
            : "Add permit"
      }
      centered
      size="lg"
    >
      {/* Keyed and mounted only while open, so nothing half-typed follows the
          admin on to the next permit. */}
      {target && (
        <AddPermitForm
          key={`${target.category}:${target.projectId}:${target.projectName}`}
          target={target}
          projects={projects}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function AddPermitForm({
  target,
  projects,
  onClose,
}: {
  target: AddTarget;
  projects: { id: number; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [category, setCategory] = useState<PermitCategory>(target.category);
  // Locked to a project when renewing; free to pick or type when adding.
  const [projectName, setProjectName] = useState(target.projectName);
  const [dldNumber, setDldNumber] = useState("");
  const [developer, setDeveloper] = useState("");
  const [emirate, setEmirate] = useState<string | null>("Dubai");

  const [permitNumber, setPermitNumber] = useState("");
  const [label, setLabel] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(() => defaultListingEnd(today));
  const [endTouched, setEndTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRenewal = target.projectId !== null;
  // An exact name match attaches to that project; anything else creates one.
  const matched = projects.find(
    (p) => p.name.toLowerCase() === projectName.trim().toLowerCase(),
  );
  const projectId = target.projectId ?? matched?.id ?? null;
  const willCreateProject = category === "offplan" && projectId === null;

  // Permits run a year, so the end date follows the start until it is edited.
  const onStart = (v: string) => {
    setStart(v);
    if (!endTouched) setEnd(defaultListingEnd(v));
  };

  const saveGeneral = async () => {
    const res = await fetch("/api/admin/permits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: permitNumber,
        label,
        expiresOn: end || null,
        notes: notes.trim() || undefined,
      }),
    });
    return res;
  };

  const saveOffplan = async () => {
    const body = new FormData();
    if (projectId !== null) {
      body.set("projectId", String(projectId));
    } else {
      body.set("newName", projectName.trim());
      body.set("newDldNumber", dldNumber);
      body.set("newDeveloper", developer);
      body.set("newEmirate", emirate ?? "");
    }
    if (target.requestId) body.set("requestId", String(target.requestId));
    body.set("permitNumber", permitNumber);
    body.set("listingStart", start);
    body.set("listingEnd", end);
    if (notes.trim()) body.set("notes", notes.trim());
    for (const f of files) body.append("qr", f);
    return fetch("/api/permits/issue", { method: "POST", body });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = category === "general" ? await saveGeneral() : await saveOffplan();
    setSaving(false);

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "" }));
      setError(msg || "Couldn't save the permit.");
      return;
    }

    onClose();
    router.refresh();
    notifications.show({
      title: isRenewal ? "Permit renewed" : "Permit added",
      message:
        category === "general" ? label : projectName.trim() || permitNumber,
      color: "green",
    });
  };

  const ready =
    category === "general"
      ? permitNumber.trim() && label.trim().length >= 2
      : permitNumber.trim() && projectName.trim() && start && end;

  return (
    <Stack>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {/* Renewing is always the same kind as what it replaces. */}
      {!isRenewal && (
        <SegmentedControl
          value={category}
          onChange={(v) => setCategory(v as PermitCategory)}
          fullWidth
          data={[
            { value: "offplan", label: "Offplan project" },
            { value: "general", label: "General / company" },
          ]}
        />
      )}

      {category === "offplan" ? (
        <>
          <Autocomplete
            label="Project"
            placeholder="Start typing, or type a new project name"
            description={
              willCreateProject
                ? "Not tracked yet — it will be created with this permit"
                : "Pick a tracked project to renew, or type a name to add one"
            }
            data={projects.map((p) => p.name)}
            value={projectName}
            onChange={setProjectName}
            disabled={isRenewal}
            limit={8}
            required
            data-autofocus
          />

          {willCreateProject && (
            <>
              <Group grow align="flex-start">
                <TextInput
                  label="DLD project number"
                  placeholder="4131"
                  inputMode="numeric"
                  description="Optional — developer-level permits have none"
                  value={dldNumber}
                  onChange={(e) => setDldNumber(e.currentTarget.value)}
                />
                <Select
                  label="Emirate"
                  data={EMIRATES}
                  value={emirate}
                  onChange={setEmirate}
                  allowDeselect={false}
                />
              </Group>
              <TextInput
                label="Developer"
                placeholder="AMIS SIGNATURE"
                value={developer}
                onChange={(e) => setDeveloper(e.currentTarget.value)}
              />
              <Divider />
            </>
          )}

          <TextInput
            label="Permit number"
            placeholder="0487839955"
            inputMode="numeric"
            description="6–15 digits, as issued by DLD"
            value={permitNumber}
            onChange={(e) => setPermitNumber(e.currentTarget.value)}
            required
          />

          <Group grow>
            <TextInput
              label="Listing start"
              type="date"
              value={start}
              onChange={(e) => onStart(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Listing end"
              type="date"
              description="Defaults to a year less a day"
              value={end}
              onChange={(e) => {
                setEndTouched(true);
                setEnd(e.currentTarget.value);
              }}
              required
            />
          </Group>

          <FileInput
            label="QR codes"
            description="All four DLD variants at once — the variant is read from each file name"
            placeholder="Choose files"
            leftSection={<IconUpload size={16} />}
            accept="image/png,image/jpeg"
            value={files}
            onChange={setFiles}
            multiple
            clearable
          />
        </>
      ) : (
        <>
          <TextInput
            label="Permit code"
            placeholder="2113748196"
            description="Paste it as you received it — everything but the digits is dropped"
            value={permitNumber}
            onChange={(e) => setPermitNumber(e.currentTarget.value)}
            required
            data-autofocus
          />
          <TextInput
            label="What it covers"
            placeholder="HR videos, activations, general social posts"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Expires"
            type="date"
            description="Optional, and a warning only — routing follows the switch"
            value={end}
            onChange={(e) => {
              setEndTouched(true);
              setEnd(e.currentTarget.value);
            }}
          />
          <Text size="xs" c="dimmed">
            Added switched on. Work logged under an active code is reviewed by a
            manager rather than a team lead; switch it off later from the row.
          </Text>
        </>
      )}

      <Textarea
        label="Notes"
        placeholder="Anything worth knowing later — a one-day event permit, a caveat"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        minRows={2}
        autosize
      />

      {category === "offplan" && (
        <Text size="xs" c="dimmed">
          Recorded as a new permit; the one it replaces is kept as history.
        </Text>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={saving} disabled={!ready}>
          {isRenewal ? "Record renewal" : "Add permit"}
        </Button>
      </Group>
    </Stack>
  );
}
