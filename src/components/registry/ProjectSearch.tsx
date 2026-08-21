"use client";

import { useMemo, useState } from "react";
import { matchSorter } from "match-sorter";
import {
  Anchor,
  Box,
  Button,
  Card,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconQrcode, IconSearch } from "@tabler/icons-react";
import { QrDialog, type QrTarget } from "./QrDialog";
import { StatusBadge } from "./StatusBadge";
import { STATUS_LABEL, type PermitStatus } from "@/lib/registry/permit-status";
import type { ProjectRow } from "@/lib/registry/queries";

type Filter = PermitStatus | "all";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const month = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString(
    "en-GB",
    { month: "short", timeZone: "UTC" },
  );
  return `${d} ${month} ${y}`;
}

function StatTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick}>
      <Paper
        withBorder
        p="md"
        radius="md"
        bg={active ? "var(--mantine-color-brand-light)" : undefined}
      >
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="xl" fw={700}>
          {value}
        </Text>
      </Paper>
    </UnstyledButton>
  );
}

/**
 * The project list, filtered in the browser.
 *
 * `showDetails` and `showQr` are decided on the server and the rows arrive
 * already redacted — these only decide what to draw. Never treat them as the
 * security boundary; see src/lib/registry/visibility.ts.
 */
export function ProjectSearch({
  projects,
  showDetails,
  showQr,
}: {
  projects: ProjectRow[];
  showDetails: boolean;
  showQr: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("all");
  const [emirate, setEmirate] = useState("all");
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);

  const emirates = useMemo(
    () =>
      [...new Set(projects.map((p) => p.emirate).filter(Boolean))].sort() as string[],
    [projects],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  const tiles: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All projects" },
    { key: "active", label: STATUS_LABEL.active },
    { key: "expiring", label: STATUS_LABEL.expiring },
    { key: "expired", label: STATUS_LABEL.expired },
    { key: "none", label: STATUS_LABEL.none },
  ];

  const agentLabel = (st: PermitStatus) =>
    showDetails ? undefined : st === "active" ? "Available" : "Not available";

  // 400 rows filter in well under a frame, so there is no debounce and no
  // server round trip — every keystroke applies immediately.
  const results = useMemo(() => {
    // People without detail access are shown only what they may market;
    // anything lapsed or missing a permit is simply absent.
    let rows = showDetails
      ? projects
      : projects.filter((p) => p.status === "active");
    if (showDetails && status !== "all")
      rows = rows.filter((p) => p.status === status);
    if (emirate !== "all") rows = rows.filter((p) => p.emirate === emirate);
    if (!query.trim()) return rows;
    return matchSorter(rows, query.trim(), {
      keys: ["name", "developer", "dldProjectNumber", "permitNumber"],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [projects, query, status, emirate, showDetails]);

  const qrButton = (p: ProjectRow) => {
    if (!showQr) return null;
    if (p.fileCount > 0) {
      return (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconQrcode size={14} />}
          onClick={() => setQrTarget({ projectId: p.id, projectName: p.name })}
        >
          QR ({p.fileCount})
        </Button>
      );
    }
    // Not yet migrated off the sheet's Dropbox folder.
    if (p.qrUrl) {
      return (
        <Anchor href={p.qrUrl} target="_blank" rel="noreferrer" size="xs">
          Dropbox
        </Anchor>
      );
    }
    return null;
  };

  return (
    <>
      {/* The summary row doubles as the status filter, rather than showing the
          same counts twice. People without detail access only ever see
          available projects, so there is nothing for them to switch between. */}
      {showDetails && (
        <SimpleGrid cols={{ base: 2, lg: 5 }} mb="lg">
          {tiles.map((t) => (
            <StatTile
              key={t.key}
              label={t.label}
              value={counts[t.key] ?? 0}
              active={status === t.key}
              onClick={() => setStatus(t.key)}
            />
          ))}
        </SimpleGrid>
      )}

      <Card withBorder radius="md" p={0}>
        <Group p="md" gap="md" wrap="wrap">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            placeholder={
              showDetails
                ? "Search project, developer, project # or permit #"
                : "Search project or developer"
            }
            style={{ flex: "1 1 320px" }}
          />
          {emirates.length > 1 && (
            <Select
              value={emirate}
              onChange={(v) => setEmirate(v ?? "all")}
              data={[
                { value: "all", label: "All emirates" },
                ...emirates.map((e) => ({ value: e, label: e })),
              ]}
              allowDeselect={false}
              w={180}
            />
          )}
          <Text size="xs" c="dimmed" ml="auto">
            {showDetails
              ? `${results.length} of ${projects.length}`
              : `${results.length} available`}
          </Text>
        </Group>

        <Box visibleFrom="md">
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                {showDetails && <Table.Th>Project #</Table.Th>}
                {showDetails && <Table.Th>Permit #</Table.Th>}
                {showDetails && <Table.Th>Expires</Table.Th>}
                <Table.Th>Status</Table.Th>
                {showQr && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {p.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {p.developer ?? "Developer not recorded"}
                    </Text>
                  </Table.Td>
                  {showDetails && (
                    <Table.Td>
                      <Text size="sm">{p.dldProjectNumber ?? "—"}</Text>
                    </Table.Td>
                  )}
                  {showDetails && (
                    <Table.Td>
                      <Text size="sm">{p.permitNumber ?? "—"}</Text>
                    </Table.Td>
                  )}
                  {showDetails && (
                    <Table.Td>
                      <Text size="sm">{formatDate(p.listingEnd)}</Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <StatusBadge status={p.status} label={agentLabel(p.status)} />
                  </Table.Td>
                  {showQr && (
                    <Table.Td>
                      <Group justify="flex-end">{qrButton(p)}</Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        {/* Agents are mostly on a phone between viewings. */}
        <Stack gap={0} hiddenFrom="md">
          {results.map((p) => (
            <Box
              key={p.id}
              p="md"
              style={{
                borderTop: "1px solid var(--mantine-color-default-border)",
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Box style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {p.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {p.developer ?? "Developer not recorded"}
                  </Text>
                </Box>
                <StatusBadge status={p.status} label={agentLabel(p.status)} />
              </Group>

              {showDetails && (
                <SimpleGrid cols={3} mt="sm">
                  <Box>
                    <Text size="xs" c="dimmed">
                      Project
                    </Text>
                    <Text size="xs">{p.dldProjectNumber ?? "—"}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Permit
                    </Text>
                    <Text size="xs">{p.permitNumber ?? "—"}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Expires
                    </Text>
                    <Text size="xs">{formatDate(p.listingEnd)}</Text>
                  </Box>
                </SimpleGrid>
              )}

              {showQr && <Group mt="sm">{qrButton(p)}</Group>}
            </Box>
          ))}
        </Stack>

        {results.length === 0 && (
          <Stack align="center" py="xl" gap="xs">
            <Text size="sm" c="dimmed">
              {showDetails
                ? `Nothing matches “${query}”.`
                : `No project with a live permit matches “${query}”.`}
            </Text>
            {!showDetails && (
              <Text size="xs" c="dimmed" ta="center" maw={380}>
                It may not be tracked yet, or its permit may have lapsed. Ask
                marketing before advertising it.
              </Text>
            )}
          </Stack>
        )}
      </Card>

      <QrDialog target={qrTarget} onClose={() => setQrTarget(null)} />
    </>
  );
}
