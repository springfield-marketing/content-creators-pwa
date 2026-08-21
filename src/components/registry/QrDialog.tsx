"use client";

import { useEffect, useState } from "react";
import {
  Anchor,
  Button,
  Card,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import type { QrFile } from "@/lib/registry/queries";

export type QrTarget = { projectId: number; projectName: string };

const LABEL: Record<string, string> = {
  original: "Original",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter",
};

// One state keyed by project, rather than separate loading/error flags reset on
// each open. Opening B straight after A therefore cannot flash A's codes, and
// nothing has to be cleared synchronously inside the effect.
type Result = { projectId: number; files: QrFile[] | null }; // files null = failed

export function QrDialog({
  target,
  onClose,
}: {
  target: QrTarget | null;
  onClose: () => void;
}) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const { projectId } = target;
    fetch(`/api/permits/projects/${projectId}/files`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((files: QrFile[]) => {
        if (!cancelled) setResult({ projectId, files });
      })
      .catch(() => {
        if (!cancelled) setResult({ projectId, files: null });
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Anything belonging to a previous project reads as "still loading".
  const current = target && result?.projectId === target.projectId ? result : null;
  const files = current?.files ?? null;
  const failed = current !== null && current.files === null;

  return (
    <Modal
      opened={!!target}
      onClose={onClose}
      title={target?.projectName ?? ""}
      size="lg"
      centered
    >
      <Text size="sm" c="dimmed" mb="md">
        QR codes on the current permit. Right-click to save, or open the image
        to download it full size.
      </Text>

      {failed && (
        <Text size="sm" c="red">
          Couldn&apos;t load the QR codes. Try again.
        </Text>
      )}

      {!failed && !files && (
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={160} radius="md" />
          ))}
        </SimpleGrid>
      )}

      {files && files.length === 0 && (
        <Text size="sm" c="dimmed">
          No QR codes are stored against this permit yet.
        </Text>
      )}

      {files && files.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          {files.map((f) => (
            <Card key={f.variant} withBorder padding="xs" radius="md">
              <Stack gap="xs" align="center">
                {/* Blob-hosted small square PNGs — no resizing to do, so a
                    plain img rather than next/image. */}
                <Image
                  src={f.url}
                  alt={`${LABEL[f.variant] ?? f.variant} QR code`}
                  h={120}
                  w="auto"
                  fit="contain"
                />
                <Text size="xs" fw={500}>
                  {LABEL[f.variant] ?? f.variant}
                </Text>
                <Anchor href={f.url} target="_blank" rel="noreferrer" size="xs">
                  Open
                </Anchor>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose}>
          Close
        </Button>
      </Group>
    </Modal>
  );
}
