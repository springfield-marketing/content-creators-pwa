"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconDeviceFloppy } from "@tabler/icons-react";
import { creators, currentMonth, targets } from "@/lib/mock-data";

type Row = { shoots: number; deliverables: number; posted: number };

// Screen 10 — Targets: monthly KPI targets per creator.
export default function Targets() {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      creators
        .filter((c) => c.active)
        .map((c) => {
          const t = targets.find(
            (t) => t.creatorId === c.id && t.month === currentMonth
          );
          return [
            c.id,
            {
              shoots: t?.shoots ?? 0,
              deliverables: t?.deliverables ?? 0,
              posted: t?.posted ?? 0,
            },
          ];
        })
    )
  );

  const update = (id: string, field: keyof Row, value: number | string) =>
    setRows((r) => ({
      ...r,
      [id]: { ...r[id], [field]: Number(value) || 0 },
    }));

  const copyLastMonth = () => {
    // Mock: last month's targets equal the current stored ones.
    notifications.show({
      title: "Copied from " + dayjs(currentMonth).subtract(1, "month").format("MMMM"),
      message: "Targets filled in — adjust and save.",
      color: "blue",
    });
  };

  const save = () =>
    notifications.show({
      title: "Targets saved",
      message: "Creators see the new targets on their progress screen.",
      color: "green",
    });

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
            data={[
              {
                value: currentMonth,
                label: dayjs(currentMonth).format("MMMM YYYY"),
              },
            ]}
            value={currentMonth}
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
            {creators
              .filter((c) => c.active)
              .map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {c.name}
                    </Text>
                  </Table.Td>
                  {(["shoots", "deliverables", "posted"] as const).map((f) => (
                    <Table.Td key={f}>
                      <NumberInput
                        value={rows[c.id][f]}
                        onChange={(v) => update(c.id, f, v)}
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

      <Group justify="flex-end">
        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save}>
          Save targets
        </Button>
      </Group>
    </Stack>
  );
}
