"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  FileInput,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { defaultListingEnd } from "@/lib/registry/issue";
// The seven, from the lib that also maps them to an issuing authority — the
// same list the permits_emirate CHECK constraint holds.
import { EMIRATES } from "@/lib/registry/authority";


export type AddTarget = {
  /** An existing project to renew against, or null to add a new one. */
  projectId: number | null;
  projectName: string;
  /** Closes the request this fulfils, if any. */
  requestId?: number;
};

/**
 * Add a permit, or renew an existing one.
 *
 * One form, one field set, whatever the permit covers — both kinds are
 * Trakheesi permits and a person adding one sets out to do the same thing
 * either way. What used to be a category switch deciding which half of the
 * form to show is now a single checkbox saying who reviews the videos logged
 * under it, which is the one thing the two kinds actually do differently.
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
        target?.projectId ? `Renew — ${target.projectName}` : "Add permit"
      }
      centered
      size="lg"
    >
      {/* Keyed and mounted only while open, so nothing half-typed follows the
          admin on to the next permit. */}
      {target && (
        <AddPermitForm
          key={`${target.projectId}:${target.projectName}`}
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

  // What the permit covers. A project name when it covers a project, whatever
  // the code is for when it does not — the same box either way.
  const [covers, setCovers] = useState(target.projectName);
  const [dldNumber, setDldNumber] = useState("");
  const [developer, setDeveloper] = useState("");
  const [emirate, setEmirate] = useState<string | null>("Dubai");

  const [permitNumber, setPermitNumber] = useState("");
  const [end, setEnd] = useState(() => defaultListingEnd(today));
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  // Off by default: a permit is a permit. On, it says this code's videos go to
  // a manager rather than the team lead — which is the one thing the two kinds
  // of permit genuinely do differently, so it is asked rather than guessed.
  const [companyContent, setCompanyContent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRenewal = target.projectId !== null;
  // An exact name match attaches to that project; anything else creates one.
  const matched = projects.find(
    (p) => p.name.toLowerCase() === covers.trim().toLowerCase(),
  );
  const projectId = target.projectId ?? matched?.id ?? null;
  const willCreateProject = !companyContent && projectId === null;
  const attachesToProject = !companyContent && projectId !== null;

  // One endpoint for both, because it is one form and one thing being recorded.
  const submit = async () => {
    setSaving(true);
    setError(null);

    const body = new FormData();
    body.set("permitNumber", permitNumber);
    body.set("emirate", emirate ?? "");
    body.set("covers", covers.trim());
    body.set("listingEnd", end);
    if (notes.trim()) body.set("notes", notes.trim());
    for (const f of files) body.append("qr", f);

    if (companyContent) {
      body.set("companyContent", "true");
    } else if (projectId !== null) {
      body.set("projectId", String(projectId));
    } else {
      body.set("newName", covers.trim());
      body.set("newDldNumber", dldNumber);
      body.set("newDeveloper", developer);
      body.set("newEmirate", emirate ?? "");
    }
    if (target.requestId) body.set("requestId", String(target.requestId));

    const res = await fetch("/api/permits/issue", { method: "POST", body });
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
      message: covers.trim() || permitNumber,
      color: "green",
    });
  };

  const ready = !!permitNumber.trim() && covers.trim().length >= 2 && !!end;

  return (
    <Stack>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      <TextInput
        label="Permit number"
        placeholder="2113748196"
        description="Paste it as you received it"
        value={permitNumber}
        onChange={(e) => setPermitNumber(e.currentTarget.value)}
        required
        data-autofocus
      />

      <Group grow align="flex-start">
        <Autocomplete
          label="What it covers"
          placeholder="A project name, or what the code is for"
          description={
            willCreateProject
              ? "Not tracked yet — it will be recorded with this permit"
              : "Pick a tracked project, or type anything else"
          }
          data={projects.map((p) => p.name)}
          value={covers}
          onChange={setCovers}
          disabled={isRenewal}
          limit={8}
          required
        />
        <Select
          label="Emirate"
          description={
            attachesToProject
              ? "Taken from the project this covers"
              : "Decides the authority"
          }
          data={EMIRATES}
          value={emirate}
          onChange={setEmirate}
          allowDeselect={false}
          // A permit covering a tracked project inherits that project's
          // emirate server-side, so offering the choice here would only let
          // someone pick one and see another.
          disabled={attachesToProject}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label="DLD project number"
          placeholder="4131"
          inputMode="numeric"
          description="Optional — company codes and developer-level permits have none"
          value={dldNumber}
          onChange={(e) => setDldNumber(e.currentTarget.value)}
          disabled={companyContent || !willCreateProject}
        />
        <TextInput
          label="Developer"
          placeholder="AMIS SIGNATURE"
          description="Optional"
          value={developer}
          onChange={(e) => setDeveloper(e.currentTarget.value)}
          disabled={companyContent || !willCreateProject}
        />
      </Group>

      <TextInput
        label="Expires"
        type="date"
        description="Defaults to a year less a day"
        value={end}
        onChange={(e) => setEnd(e.currentTarget.value)}
        required
      />

      <FileInput
        label="QR codes"
        description="One, or all four DLD variants at once — the variant is read from each file name"
        placeholder="Choose files"
        leftSection={<IconUpload size={16} />}
        accept="image/png,image/jpeg"
        value={files}
        onChange={setFiles}
        multiple
        clearable
      />

      <Textarea
        label="Notes"
        placeholder="Anything worth knowing later — a one-day event permit, a caveat"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        minRows={2}
        autosize
      />

      {/* Renewing keeps whatever the permit it replaces was. */}
      {!isRenewal && (
        <>
          <Checkbox
            label="Company content — a manager reviews these"
            description="For codes covering our own content rather than a project. Videos logged under one go to a manager instead of the team lead."
            checked={companyContent}
            onChange={(e) => setCompanyContent(e.currentTarget.checked)}
          />
          {companyContent && (
            <Text size="xs" c="dimmed">
              Added switched on, and stored as digits only. Switch it off later
              from the row to stop it routing review.
            </Text>
          )}
        </>
      )}

      {!companyContent && (
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
