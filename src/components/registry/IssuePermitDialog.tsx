"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  FileInput,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { defaultListingEnd } from "@/lib/registry/issue";

/**
 * `projectId` null means the project is not tracked yet and the form creates
 * it — that is how a request for something unlisted gets fulfilled.
 * `requestId` closes the request that prompted this, if any.
 */
export type IssueTarget = {
  projectId: number | null;
  projectName: string;
  requestId?: number;
};

export function IssuePermitDialog({
  target,
  onClose,
}: {
  target: IssueTarget | null;
  onClose: () => void;
}) {
  const isNew = target?.projectId == null;
  return (
    <Modal
      opened={!!target}
      onClose={onClose}
      title={isNew ? `Add “${target?.projectName}”` : target?.projectName}
      centered
    >
      {/* Keyed and mounted only while open, so every field starts empty for the
          next project. A half-typed permit number must not follow the admin
          from one row to the next. */}
      {target && (
        <IssueForm
          key={`${target.projectId}:${target.projectName}`}
          target={target}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function IssueForm({
  target,
  onClose,
}: {
  target: IssueTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const [permitNumber, setPermitNumber] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [endTouched, setEndTouched] = useState(false);
  const [newDldNumber, setNewDldNumber] = useState("");
  const [newDeveloper, setNewDeveloper] = useState("");
  const [newEmirate, setNewEmirate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = target.projectId == null;

  // Permits run a year, so the end date follows the start until it is edited.
  const onStart = (v: string) => {
    setStart(v);
    if (!endTouched) setEnd(defaultListingEnd(v));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    const body = new FormData();
    if (target.projectId != null) {
      body.set("projectId", String(target.projectId));
    } else {
      body.set("newName", target.projectName);
      body.set("newDldNumber", newDldNumber);
      body.set("newDeveloper", newDeveloper);
      body.set("newEmirate", newEmirate);
    }
    if (target.requestId) body.set("requestId", String(target.requestId));
    body.set("permitNumber", permitNumber);
    body.set("listingStart", start);
    body.set("listingEnd", end);
    for (const f of files) body.append("qr", f);

    const res = await fetch("/api/permits/issue", { method: "POST", body });
    setSaving(false);

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "" }));
      setError(msg || "Couldn't record the permit.");
      return;
    }

    onClose();
    router.refresh();
    notifications.show({
      title: "Permit recorded",
      message: `${target.projectName} — ${permitNumber}`,
      color: "green",
    });
  };

  const ready = permitNumber.trim() && start && end;

  return (
    <Stack>
      {isNew && (
        <Alert color="blue" variant="light">
          This project isn&apos;t tracked yet — it will be created with the
          permit.
        </Alert>
      )}

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {isNew && (
        <>
          <TextInput
            label="DLD project number"
            description="Optional — developer-level permits have none"
            value={newDldNumber}
            onChange={(e) => setNewDldNumber(e.currentTarget.value)}
          />
          <TextInput
            label="Developer"
            value={newDeveloper}
            onChange={(e) => setNewDeveloper(e.currentTarget.value)}
          />
          <TextInput
            label="Emirate"
            value={newEmirate}
            onChange={(e) => setNewEmirate(e.currentTarget.value)}
          />
        </>
      )}

      <TextInput
        label="Permit number"
        placeholder="6–15 digits"
        value={permitNumber}
        onChange={(e) => setPermitNumber(e.currentTarget.value)}
        required
        data-autofocus
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
        description="The four PNGs from Trakheesi — the variant is read from each filename"
        placeholder="Choose files"
        leftSection={<IconUpload size={16} />}
        accept="image/png,image/jpeg"
        value={files}
        onChange={setFiles}
        multiple
        clearable
      />

      <Text size="xs" c="dimmed">
        A renewal is recorded as a new permit; the previous one is kept.
      </Text>

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={saving} disabled={!ready}>
          Record permit
        </Button>
      </Group>
    </Stack>
  );
}
