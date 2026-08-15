"use client";

// Screen 10 — Targets on the real table, with working "copy last month".

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconDeviceFloppy } from "@tabler/icons-react";

type Row = {
  creatorId: string;
  creatorName: string;
  shoots: number;
  deliverables: number;
  posted: number;
  images: number;
  craft: "video" | "photo" | "both";
};

// Photo and video are measured on different units, so each tab shows only the
// fields that discipline is scored on. A 'both' creator appears in each, with a
// separate target per craft — the leaderboard averages the two attainments.
const TABS = {
  video: {
    label: "Videographers",
    fields: ["shoots", "deliverables", "posted"],
    heads: ["Shoots", "Deliverables", "Posted"],
  },
  photo: {
    label: "Photographers",
    fields: ["shoots", "images", "posted"],
    heads: ["Shoots", "Images", "Posted"],
  },
} as const;

export default function Targets() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [result, setResult] = useState<{ key: string; rows: Row[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/targets?month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setResult({ key: month, rows: d.rows }))
      .catch(() => !cancelled && setResult({ key: month, rows: [] }));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const rows = result?.key === month ? result.rows : null;
  const setRows = (fn: (r: Row[] | null) => Row[]) =>
    setResult((cur) => (cur ? { ...cur, rows: fn(cur.rows) } : cur));

  const months = Array.from({ length: 4 }, (_, i) => {
    const m = dayjs().add(1 - i, "month");
    return { value: m.format("YYYY-MM"), label: m.format("MMMM YYYY") };
  });

  const update = (
    id: string,
    field: "shoots" | "deliverables" | "posted" | "images",
    value: number | string
  ) =>
    setRows((r) =>
      (r ?? []).map((row) =>
        row.creatorId === id ? { ...row, [field]: Number(value) || 0 } : row
      )
    );

  const copyLastMonth = async () => {
    const prev = dayjs(`${month}-01`).subtract(1, "month").format("YYYY-MM");
    const res = await fetch(`/api/admin/targets?month=${prev}`);
    if (!res.ok) return;
    const d = await res.json();
    const byId = new Map(
      (d.rows as Row[]).map((r) => [r.creatorId, r])
    );
    setRows((cur) =>
      (cur ?? []).map((r) => {
        const p = byId.get(r.creatorId);
        return p
          ? {
              ...r,
              shoots: p.shoots,
              deliverables: p.deliverables,
              posted: p.posted,
              images: p.images,
            }
          : r;
      })
    );
    notifications.show({
      title: `Copied from ${dayjs(`${prev}-01`).format("MMMM")}`,
      message: "Adjust and save.",
      color: "blue",
    });
  };

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    const res = await fetch("/api/admin/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        rows: rows.map(({ creatorId, shoots, deliverables, posted, images }) => ({
          creatorId,
          shoots,
          deliverables,
          posted,
          images,
        })),
      }),
    });
    setSaving(false);
    notifications.show(
      res.ok
        ? {
            title: "Targets saved",
            message: "Creators see them on their progress screen.",
            color: "green",
          }
        : { title: "Save failed", message: "Try again.", color: "red" }
    );
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Targets</Title>
          <Text size="sm" c="dimmed">
            Monthly KPI targets per creator
          </Text>
        </div>
        <Group>
          <Select
            data={months}
            value={month}
            onChange={(v) => v && setMonth(v)}
            allowDeselect={false}
            maw={170}
          />
          <Button
            variant="default"
            leftSection={<IconCopy size={16} />}
            onClick={copyLastMonth}
          >
            Copy last month
          </Button>
        </Group>
      </Group>

      {rows === null ? (
        <Skeleton height={320} radius="lg" />
      ) : (
        <Tabs defaultValue="video">
          <Tabs.List mb="sm">
            {(["video", "photo"] as const).map((k) => (
              <Tabs.Tab key={k} value={k}>
                {TABS[k].label} (
                {rows.filter((r) => r.craft === k || r.craft === "both").length})
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {(["video", "photo"] as const).map((k) => {
            const tab = TABS[k];
            const shown = rows.filter(
              (r) => r.craft === k || r.craft === "both"
            );
            return (
              <Tabs.Panel key={k} value={k}>
                {shown.length === 0 ? (
                  <Card padding="sm">
                    <Text size="sm" c="dimmed">
                      Nobody is set to {tab.label.toLowerCase()} yet — set a
                      creator&apos;s craft on the Creators screen.
                    </Text>
                  </Card>
                ) : (
                  <Card padding="sm">
                    <Table verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Creator</Table.Th>
                          {tab.heads.map((h) => (
                            <Table.Th key={h}>{h}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {shown.map((r) => (
                          <Table.Tr key={r.creatorId}>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {r.creatorName}
                              </Text>
                              {r.craft === "both" && (
                                <Text size="xs" c="dimmed">
                                  also has a{" "}
                                  {k === "video" ? "photo" : "video"} target
                                </Text>
                              )}
                            </Table.Td>
                            {tab.fields.map((f) => (
                              <Table.Td key={f}>
                                <NumberInput
                                  value={r[f]}
                                  onChange={(v) => update(r.creatorId, f, v)}
                                  min={0}
                                  maw={90}
                                />
                              </Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card>
                )}
              </Tabs.Panel>
            );
          })}
        </Tabs>
      )}

      <Group justify="flex-end">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          loading={saving}
          onClick={save}
        >
          Save targets
        </Button>
      </Group>
    </Stack>
  );
}
