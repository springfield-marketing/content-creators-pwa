"use client";

import { useMemo, useState } from "react";
import { matchSorter } from "match-sorter";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconQrcode, IconSearch } from "@tabler/icons-react";
import { GeneralPermitModal } from "./GeneralPermitModal";
import { IssuePermitDialog, type IssueTarget } from "./IssuePermitDialog";
import { QrDialog, type QrTarget } from "./QrDialog";
import { StatusBadge } from "./StatusBadge";
import type { PermitRow } from "@/lib/registry/queries";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const month = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString(
    "en-GB",
    { month: "short", timeZone: "UTC" },
  );
  return `${d} ${month} ${y}`;
}

/**
 * Every permit in one table.
 *
 * Both kinds live here because they are one table now and one thing to look up.
 * They are not the same thing, so the Kind column says which, and the actions a
 * row offers differ: an offplan permit is issued, renewed and carries QR codes;
 * a general code is edited and switched on or off.
 *
 * Rows arrive already redacted — `showDetails` and `showQr` only decide what to
 * draw. See src/lib/registry/visibility.ts.
 */
export function PermitsTable({
  permits,
  showDetails,
  showQr,
  mayIssue = false,
  mayManageGeneral = false,
}: {
  permits: PermitRow[];
  showDetails: boolean;
  showQr: boolean;
  mayIssue?: boolean;
  mayManageGeneral?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);
  const [issueTarget, setIssueTarget] = useState<IssueTarget | null>(null);
  const [editing, setEditing] = useState<PermitRow | "new" | null>(null);

  const results = useMemo(() => {
    let rows = permits;
    // Without detail access a permit is only worth showing if it is usable.
    if (!showDetails) rows = rows.filter((p) => p.status === "active");
    if (kind !== "all") rows = rows.filter((p) => p.category === kind);
    if (!query.trim()) return rows;
    return matchSorter(rows, query.trim(), {
      keys: ["name", "developer", "permitNumber", "dldProjectNumber"],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [permits, query, kind, showDetails]);

  const actionsFor = (p: PermitRow) => {
    if (p.category === "general") {
      return mayManageGeneral ? (
        <Button size="xs" variant="subtle" onClick={() => setEditing(p)}>
          Edit
        </Button>
      ) : null;
    }
    return (
      <>
        {mayIssue && (
          <Button
            size="xs"
            variant="subtle"
            onClick={() =>
              setIssueTarget({ projectId: p.projectId, projectName: p.name })
            }
          >
            {p.status === "none" ? "Issue" : "Renew"}
          </Button>
        )}
        {showQr && p.fileCount > 0 && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconQrcode size={14} />}
            onClick={() =>
              setQrTarget({ projectId: p.projectId!, projectName: p.name })
            }
          >
            QR ({p.fileCount})
          </Button>
        )}
        {showQr && p.fileCount === 0 && p.qrUrl && (
          // Not yet migrated off the sheet's Dropbox folder.
          <Anchor href={p.qrUrl} target="_blank" rel="noreferrer" size="xs">
            Dropbox
          </Anchor>
        )}
      </>
    );
  };

  const hasActions = showQr || mayIssue || mayManageGeneral;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Text fw={600} size="lg">
            Permits
          </Text>
          <Text size="sm" c="dimmed">
            {showDetails
              ? "Offplan project permits and general content codes"
              : "Projects you can market right now"}
          </Text>
        </div>
        {mayManageGeneral && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setEditing("new")}
          >
            Add general permit
          </Button>
        )}
      </Group>

      <Card withBorder radius="md" p={0}>
        <Group p="md" gap="md" wrap="wrap">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            placeholder="Search project, developer or permit number"
            style={{ flex: "1 1 320px" }}
          />
          {showDetails && (
            <SegmentedControl
              value={kind}
              onChange={setKind}
              size="sm"
              data={[
                { value: "all", label: "All" },
                { value: "offplan", label: "Offplan" },
                { value: "general", label: "General" },
              ]}
            />
          )}
          <Text size="xs" c="dimmed" ml="auto">
            {results.length} of {permits.length}
          </Text>
        </Group>

        <Box visibleFrom="md">
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Permit</Table.Th>
                {showDetails && <Table.Th>Kind</Table.Th>}
                {showDetails && <Table.Th>Number</Table.Th>}
                {showDetails && <Table.Th>Expires</Table.Th>}
                <Table.Th>Status</Table.Th>
                {hasActions && <Table.Th />}
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
                      {p.category === "general"
                        ? "Company content"
                        : (p.developer ?? "Developer not recorded")}
                    </Text>
                  </Table.Td>
                  {showDetails && (
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={p.category === "general" ? "grape" : "blue"}
                      >
                        {p.category === "general" ? "General" : "Offplan"}
                      </Badge>
                    </Table.Td>
                  )}
                  {showDetails && (
                    <Table.Td>
                      <Text size="sm">{p.permitNumber}</Text>
                    </Table.Td>
                  )}
                  {showDetails && (
                    <Table.Td>
                      <Text size="sm">{formatDate(p.listingEnd)}</Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <StatusBadge
                      status={p.status}
                      label={
                        p.category === "general"
                          ? p.isActive
                            ? "On"
                            : "Off"
                          : showDetails
                            ? undefined
                            : "Available"
                      }
                    />
                  </Table.Td>
                  {hasActions && (
                    <Table.Td>
                      <Group justify="flex-end" gap="xs" wrap="nowrap">
                        {actionsFor(p)}
                      </Group>
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
                  {showDetails && (
                    <Text size="xs" c="dimmed">
                      {p.permitNumber} · {formatDate(p.listingEnd)}
                    </Text>
                  )}
                </Box>
                <StatusBadge
                  status={p.status}
                  label={
                    p.category === "general"
                      ? p.isActive
                        ? "On"
                        : "Off"
                      : showDetails
                        ? undefined
                        : "Available"
                  }
                />
              </Group>
              {hasActions && (
                <Group mt="sm" gap="xs">
                  {actionsFor(p)}
                </Group>
              )}
            </Box>
          ))}
        </Stack>

        {results.length === 0 && (
          <Stack align="center" py="xl" gap="xs">
            <Text size="sm" c="dimmed">
              Nothing matches “{query}”.
            </Text>
            {!showDetails && (
              <Text size="xs" c="dimmed" ta="center" maw={380}>
                It may not be tracked yet, or its permit may have lapsed. Ask
                marketing before advertising it.
              </Text>
            )}
            {mayIssue && query.trim() && (
              <Button
                size="xs"
                mt="sm"
                onClick={() =>
                  setIssueTarget({ projectId: null, projectName: query.trim() })
                }
              >
                Add “{query.trim()}” and issue a permit
              </Button>
            )}
          </Stack>
        )}
      </Card>

      <QrDialog target={qrTarget} onClose={() => setQrTarget(null)} />
      <IssuePermitDialog
        target={issueTarget}
        onClose={() => setIssueTarget(null)}
      />
      <GeneralPermitModal
        target={editing}
        onClose={() => setEditing(null)}
      />
    </Stack>
  );
}
