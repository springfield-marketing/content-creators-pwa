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
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { defaultListingEnd } from "@/lib/registry/issue";
// The seven, from the lib that also maps them to an issuing authority — the
// same list the permits_emirate CHECK constraint holds.
import { EMIRATES } from "@/lib/registry/authority";
import { FieldLabel } from "./FieldLabel";


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
  const [transactionNumber, setTransactionNumber] = useState("");
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
    if (transactionNumber.trim()) {
      body.set("transactionNumber", transactionNumber.trim());
    }
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

      <Group grow align="flex-start">
        <TextInput
          label={<FieldLabel hint="Paste it as you received it.">Permit number</FieldLabel>}
          placeholder="2113748196"
          value={permitNumber}
          onChange={(e) => setPermitNumber(e.currentTarget.value)}
          required
          data-autofocus
        />
        <TextInput
          label={
            <FieldLabel hint="Optional. The DLD transaction this permit was issued against.">
              Transaction number
            </FieldLabel>
          }
          placeholder="Optional"
          value={transactionNumber}
          onChange={(e) => setTransactionNumber(e.currentTarget.value)}
        />
      </Group>

      <Group grow align="flex-start">
        <Autocomplete
          label={
            <FieldLabel
              hint={
                companyContent
                  ? "What the code is for — HR videos, activations, general social posts."
                  : willCreateProject
                    ? "Not tracked yet. This project will be recorded along with the permit."
                    : "Attaches to this tracked project. Recorded as a new permit; the one it replaces is kept as history."
              }
            >
              What it covers
            </FieldLabel>
          }
          placeholder="A project name, or what the code is for"
          data={projects.map((p) => p.name)}
          value={covers}
          onChange={setCovers}
          disabled={isRenewal}
          limit={8}
          required
        />
        <Select
          label={
            <FieldLabel
              hint={
                attachesToProject
                  ? "Taken from the project this covers."
                  : "Decides which authority issued it — Trakheesi in Dubai, Madhmoun in Abu Dhabi."
              }
            >
              Emirate
            </FieldLabel>
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
          label={
            <FieldLabel hint="Optional. Company codes and developer-level permits have none.">
              DLD project number
            </FieldLabel>
          }
          placeholder="4131"
          inputMode="numeric"
          value={dldNumber}
          onChange={(e) => setDldNumber(e.currentTarget.value)}
          disabled={companyContent || !willCreateProject}
        />
        <TextInput
          label="Developer"
          placeholder="Optional"
          value={developer}
          onChange={(e) => setDeveloper(e.currentTarget.value)}
          disabled={companyContent || !willCreateProject}
        />
      </Group>

      <Group grow align="flex-start">
        <TextInput
          label={
            <FieldLabel hint="Defaults to a year less a day from today.">
              Expires
            </FieldLabel>
          }
          type="date"
          value={end}
          onChange={(e) => setEnd(e.currentTarget.value)}
          required
        />
        <FileInput
          label={
            <FieldLabel hint="One, or all four DLD variants at once — the variant is read from each file name.">
              QR codes
            </FieldLabel>
          }
          placeholder="Choose files"
          leftSection={<IconUpload size={16} />}
          accept="image/png,image/jpeg"
          value={files}
          onChange={setFiles}
          multiple
          clearable
        />
      </Group>

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
        <Checkbox
          label={
            <FieldLabel hint="For codes covering our own content rather than a project. Videos logged under one go to a manager instead of the team lead, the code is stored as digits only, and it is added switched on — switch it off later from the row to stop it routing review.">
              Company content — a manager reviews these
            </FieldLabel>
          }
          checked={companyContent}
          onChange={(e) => setCompanyContent(e.currentTarget.checked)}
        />
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
