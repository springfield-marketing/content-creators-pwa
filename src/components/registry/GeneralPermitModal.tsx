"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { PermitRow } from "@/lib/registry/queries";

/**
 * Add or edit a general permit — the company-content codes that decide who
 * reviews a deliverable.
 *
 * A modal on the permits list rather than its own screen. It was a whole page
 * when general permits were a separate table; now they are rows in the same
 * list as everything else, and editing one is a row action.
 */
export function GeneralPermitModal({
  target,
  onClose,
}: {
  /** A row to edit, "new" to add one, or null for closed. */
  target: PermitRow | "new" | null;
  onClose: () => void;
}) {
  const isNew = target === "new";
  return (
    <Modal
      opened={!!target}
      onClose={onClose}
      title={isNew ? "Add general permit" : "Edit general permit"}
      centered
    >
      {target && (
        <GeneralPermitForm
          key={isNew ? "new" : target.id}
          row={isNew ? null : target}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function GeneralPermitForm({
  row,
  onClose,
}: {
  row: PermitRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(row?.permitNumber ?? "");
  const [label, setLabel] = useState(row?.name ?? "");
  const [expiresOn, setExpiresOn] = useState(row?.listingEnd ?? "");
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);

    const body = {
      code,
      label,
      expiresOn: expiresOn || null,
      ...(row ? { isActive } : {}),
    };
    const res = await fetch(
      row ? `/api/admin/permits/${row.id}` : "/api/admin/permits",
      {
        method: row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "" }));
      setError(msg || "Couldn't save that.");
      return;
    }

    onClose();
    router.refresh();
    notifications.show({
      title: row ? "Permit updated" : "Permit added",
      message: label,
      color: "green",
    });
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      <TextInput
        label="Permit code"
        description="Paste it as you received it — everything but the digits is dropped"
        value={code}
        onChange={(e) => setCode(e.currentTarget.value)}
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
        description="Optional, and a warning only — routing follows the switch below"
        value={expiresOn}
        onChange={(e) => setExpiresOn(e.currentTarget.value)}
      />

      {row && (
        <>
          <Switch
            label="Active"
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
          />
          <Text size="xs" c="dimmed">
            Switched off rather than deleted: it changes who reviews future
            work, and the trail should still explain past routing.
          </Text>
        </>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={save}
          loading={saving}
          disabled={!code.trim() || label.trim().length < 2}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}
