"use client";

// Correcting a deliverable, shared by the review queue and the review log so
// the two can't drift. Only the fields that apply to the type are shown: a
// permit for a video, an image count for a photo.

import { useState } from "react";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

export type EditableDeliverable = {
  id: string;
  type: string | null;
  url: string | null;
  title: string | null;
  permitNumber: string | null;
  imageCount: number | null;
  creatorName?: string | null;
};

export function DeliverableEditModal({
  target,
  onClose,
  onSaved,
}: {
  target: EditableDeliverable | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal
      opened={target !== null}
      onClose={onClose}
      title="Correct deliverable"
      centered
    >
      {/* Keyed so each deliverable gets a fresh form, rather than syncing
          props into state after the fact. */}
      {target && (
        <EditForm
          key={target.id}
          target={target}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function EditForm({
  target,
  onClose,
  onSaved,
}: {
  target: EditableDeliverable;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(target.url ?? "");
  const [title, setTitle] = useState(target.title ?? "");
  const [permit, setPermit] = useState(target.permitNumber ?? "");
  const [images, setImages] = useState<number | string>(target.imageCount ?? "");
  const [saving, setSaving] = useState(false);
  // Removal is destructive and the reason lands in the audit entry, so it's
  // behind a deliberate second step rather than a button next to Save.
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");

  const isVideo = target.type === "video_shoot";
  const isPhoto = target.type === "photo_shoot";

  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    const res = await fetch(`/api/admin/deliverables/${target.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", reason: reason.trim() }),
    });
    setDeleting(false);
    const data = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? { title: "Deliverable removed", message: "", color: "orange" }
        : {
            title: "Couldn't remove",
            message: data.error ?? "Try again.",
            color: "red",
          }
    );
    if (res.ok) {
      onClose();
      onSaved();
    }
  };

  const save = async () => {
    setSaving(true);
    // Only send what actually differs, so an untouched field is never written.
    const body: Record<string, unknown> = { action: "edit" };
    if (url.trim() && url.trim() !== (target.url ?? "")) body.url = url.trim();
    if (title.trim() && title.trim() !== (target.title ?? ""))
      body.title = title.trim();
    if (isVideo && permit.trim() && permit.trim() !== (target.permitNumber ?? ""))
      body.permitNumber = permit.trim();
    if (isPhoto && images !== "" && Number(images) !== target.imageCount)
      body.imageCount = Number(images);

    if (Object.keys(body).length === 1) {
      setSaving(false);
      onClose();
      return;
    }

    const res = await fetch(`/api/admin/deliverables/${target.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    notifications.show(
      res.ok
        ? { title: "Deliverable updated", message: "", color: "green" }
        : {
            title: "Couldn't save",
            message: data.error ?? "Check the values.",
            color: "red",
          }
    );
    if (res.ok) {
      onClose();
      onSaved();
    }
  };

  return (
    <Stack gap="sm">
      {target.creatorName && (
        <Text size="sm" c="dimmed">
          {target.creatorName}
        </Text>
      )}
      <TextInput
        label="Link"
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
      />
      <TextInput
        label="Title"
        description="Only used when the deliverable isn't named by its shoot."
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
      />
      {isVideo && (
        <TextInput
          label="Permit number"
          value={permit}
          onChange={(e) => setPermit(e.currentTarget.value)}
        />
      )}
      {isPhoto && (
        <NumberInput
          label="Images in the folder"
          description="Photo work logged before counts existed has none — this is where it gets filled in."
          min={0}
          max={10000}
          value={images}
          onChange={setImages}
        />
      )}
      <Group justify="space-between">
        <Button
          variant="subtle"
          color="red"
          size="compact-sm"
          onClick={() => setRemoving((v) => !v)}
        >
          {removing ? "Keep it" : "Remove"}
        </Button>
        <Group>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
        </Group>
      </Group>

      {removing && (
        <Stack gap="xs">
          <Text size="sm">
            Removing it deletes the deliverable and its review history. The
            record of what was here is kept in the activity log.
          </Text>
          <TextInput
            placeholder="Why is it being removed? (required)"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
          <Button
            color="red"
            disabled={reason.trim().length < 3}
            loading={deleting}
            onClick={remove}
          >
            Remove permanently
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
