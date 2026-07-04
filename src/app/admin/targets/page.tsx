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
};

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

  const update = (id: string, field: "shoots" | "deliverables" | "posted", value: number | string) =>
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
          ? { ...r, shoots: p.shoots, deliverables: p.deliverables, posted: p.posted }
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
        rows: rows.map(({ creatorId, shoots, deliverables, posted }) => ({
          creatorId,
          shoots,
          deliverables,
          posted,
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
        <Card padding="sm">
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Creator</Table.Th>
                <Table.Th>Shoots</Table.Th>
                <Table.Th>Deliverables</Table.Th>
                <Table.Th>Posted</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.creatorId}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {r.creatorName}
                    </Text>
                  </Table.Td>
                  {(["shoots", "deliverables", "posted"] as const).map((f) => (
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
