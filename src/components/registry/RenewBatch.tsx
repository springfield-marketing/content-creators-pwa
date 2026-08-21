"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Anchor,
  Button,
  Card,
  FileInput,
  Group,
  List,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDownload, IconUpload } from "@tabler/icons-react";

type PreviewRow = {
  projectId: number;
  name: string;
  permitNumber: string;
  listingStart: string;
  listingEnd: string;
};

type Preview = {
  ok: boolean;
  rows: PreviewRow[];
  errors: { line: number; message: string }[];
  skipped: number;
};

/**
 * Download a template, fill in the permits DLD issued, upload, check, apply.
 *
 * Preview and apply are separate calls: 396 of 402 permits share one expiry
 * date, so a batch is the normal case, and nothing is written until an admin
 * has seen exactly what the file would do.
 */
export function RenewBatch() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (f: File | null) => {
    setFile(f);
    setPreview(null);
    if (!f) return;

    setBusy(true);
    const body = new FormData();
    body.set("file", f);
    const res = await fetch("/api/permits/renewals", { method: "POST", body });
    const data = await res.json().catch(() => null);
    setBusy(false);

    if (!data) {
      notifications.show({
        title: "Couldn't read that file",
        message: "Try again.",
        color: "red",
      });
      return;
    }
    setPreview(data);
  };

  const apply = async () => {
    if (!preview?.rows.length) return;
    setBusy(true);
    const res = await fetch("/api/permits/renewals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: preview.rows.map(({ projectId, permitNumber, listingStart, listingEnd }) => ({
          projectId,
          permitNumber,
          listingStart,
          listingEnd,
        })),
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      notifications.show({
        title: "Nothing was applied",
        message: error || "Try again.",
        color: "red",
      });
      return;
    }

    const { applied } = await res.json();
    setFile(null);
    setPreview(null);
    router.refresh();
    notifications.show({
      title: `${applied} permits renewed`,
      message: "The previous permits are kept as history.",
      color: "green",
    });
  };

  return (
    <Stack gap="lg">
      <Card withBorder radius="md">
        <Stack gap="sm">
          <Text fw={600}>1. Download the template</Text>
          <Text size="sm" c="dimmed">
            Every project, soonest-expiring first. Fill in the new permit number
            and dates for the ones being renewed and leave the rest blank —
            blank rows are skipped.
          </Text>
          <Group>
            <Button
              component="a"
              href="/api/permits/renewals"
              variant="light"
              leftSection={<IconDownload size={16} />}
            >
              permit-renewals.csv
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md">
        <Stack gap="sm">
          <Text fw={600}>2. Upload it back</Text>
          <FileInput
            placeholder="Choose the filled-in CSV"
            leftSection={<IconUpload size={16} />}
            accept=".csv,text/csv"
            value={file}
            onChange={check}
            clearable
            disabled={busy}
          />

          {preview && !preview.ok && (
            <Alert color="red" variant="light" title="Nothing was applied">
              <Text size="sm" mb="xs">
                Fix these and upload again — the whole file is refused rather
                than half-applied.
              </Text>
              <List size="sm">
                {preview.errors.slice(0, 20).map((e, i) => (
                  <List.Item key={i}>
                    {e.line ? `Line ${e.line}: ` : ""}
                    {e.message}
                  </List.Item>
                ))}
              </List>
              {preview.errors.length > 20 && (
                <Text size="xs" c="dimmed" mt="xs">
                  …and {preview.errors.length - 20} more.
                </Text>
              )}
            </Alert>
          )}

          {preview?.ok && (
            <>
              <Alert color="blue" variant="light">
                {preview.rows.length} permits to renew
                {preview.skipped > 0 && `, ${preview.skipped} rows left blank`}.
                Nothing has been written yet.
              </Alert>

              <Table.ScrollContainer minWidth={520} maxHeight={360}>
                <Table stickyHeader verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Project</Table.Th>
                      <Table.Th>New permit</Table.Th>
                      <Table.Th>From</Table.Th>
                      <Table.Th>To</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.rows.map((r) => (
                      <Table.Tr key={r.projectId}>
                        <Table.Td>
                          <Text size="sm">{r.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{r.permitNumber}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{r.listingStart}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{r.listingEnd}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              <Group justify="flex-end">
                <Button onClick={apply} loading={busy}>
                  Apply {preview.rows.length} renewals
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Card>

      <Text size="xs" c="dimmed">
        QR codes are not part of a batch — attach them per project from the{" "}
        <Anchor href="/admin/permits" size="xs">
          projects list
        </Anchor>
        .
      </Text>
    </Stack>
  );
}
