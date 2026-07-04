"use client";

// Per-weekday hours editor with split-day support (up to two ranges per day,
// e.g. 10:30–13:30 + 16:00–19:00). Used by creator settings and weekly plan.

import { Group, Switch, Table, Text } from "@mantine/core";
import { TimeInput } from "@mantine/dates";

const WEEKDAYS = [
  ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"],
  ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
] as const;
export type DayKey = (typeof WEEKDAYS)[number][0];
export type Hours = Partial<Record<DayKey, [string, string][]>>;

const DEFAULT_RANGES: [string, string][] = [
  ["10:30", "13:30"],
  ["16:00", "19:00"],
];

export function WeekHoursEditor({
  value,
  onChange,
}: {
  value: Hours;
  onChange: (next: Hours) => void;
}) {
  const setDay = (key: DayKey, ranges: [string, string][] | null) => {
    const next: Hours = { ...value };
    if (!ranges || ranges.length === 0) delete next[key];
    else next[key] = ranges;
    onChange(next);
  };

  const setTime = (
    key: DayKey,
    rangeIdx: number,
    endIdx: 0 | 1,
    time: string
  ) => {
    const ranges = (value[key] ?? []).map(
      (r, i) =>
        (i === rangeIdx
          ? [endIdx === 0 ? time : r[0], endIdx === 1 ? time : r[1]]
          : r) as [string, string]
    );
    setDay(key, ranges);
  };

  return (
    <Table verticalSpacing={6}>
      <Table.Tbody>
        {WEEKDAYS.map(([key, label]) => {
          const ranges = value[key] ?? [];
          const on = ranges.length > 0;
          const split = ranges.length > 1;
          return (
            <Table.Tr key={key}>
              <Table.Td w={80}>
                <Switch
                  size="xs"
                  label={label}
                  checked={on}
                  onChange={(e) =>
                    setDay(key, e.currentTarget.checked ? DEFAULT_RANGES : null)
                  }
                />
              </Table.Td>
              <Table.Td>
                {on && (
                  <Group gap="xs" wrap="wrap">
                    {ranges.map((r, i) => (
                      <Group gap={4} wrap="nowrap" key={i}>
                        <TimeInput
                          size="xs"
                          value={r[0]}
                          onChange={(e) => setTime(key, i, 0, e.currentTarget.value)}
                        />
                        <Text size="xs" c="dimmed">
                          –
                        </Text>
                        <TimeInput
                          size="xs"
                          value={r[1]}
                          onChange={(e) => setTime(key, i, 1, e.currentTarget.value)}
                        />
                      </Group>
                    ))}
                    <Switch
                      size="xs"
                      label="Split"
                      checked={split}
                      onChange={(e) =>
                        setDay(
                          key,
                          e.currentTarget.checked
                            ? [ranges[0], ["16:00", "19:00"]]
                            : [ranges[0]]
                        )
                      }
                    />
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
