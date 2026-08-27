"use client";

import { useMemo, useState } from "react";
import { Badge, Box, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { matchSorter } from "match-sorter";

/**
 * Deliberately not a permit: a name and the fact that it can be advertised.
 *
 * No permit number, no expiry, no QR, no transaction number — not hidden by the
 * UI but never sent, so there is nothing in the payload to read out of. The
 * permits list at /admin/permits is where those live.
 */
export type AvailableProject = {
  id: number;
  name: string;
  developer: string | null;
};

/**
 * Look up whether a project can be marketed.
 *
 * Only projects with a permit in force are here, so a row appearing IS the
 * answer — the badge just says it in words. Anything expired or unpermitted is
 * absent rather than listed as unavailable, because an agent's question is
 * "may I advertise this", not "what is the state of our paperwork".
 */
export function PermitLookup({ projects }: { projects: AvailableProject[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return projects;
    return matchSorter(projects, q, {
      // Developer as well as name: "Emaar" is how someone asks for a project
      // whose exact name they cannot remember.
      keys: ["name", "developer"],
      threshold: matchSorter.rankings.CONTAINS,
    });
  }, [projects, query]);

  return (
    <Stack gap="sm">
      <TextInput
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        placeholder="Search a project or developer"
        size="md"
        autoComplete="off"
      />

      <Text size="xs" c="dimmed">
        {query.trim()
          ? `${results.length} of ${projects.length} projects`
          : `${projects.length} projects you can market`}
      </Text>

      <Card withBorder radius="md" p={0}>
        {results.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">
            Nothing matches that. A project with no permit in force cannot be
            advertised — ask marketing to request one.
          </Text>
        ) : (
          results.map((p, i) => (
            <Group
              key={p.id}
              justify="space-between"
              wrap="nowrap"
              p="md"
              style={
                i === 0
                  ? undefined
                  : {
                      borderTop:
                        "1px solid var(--mantine-color-default-border)",
                    }
              }
            >
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                  {p.name}
                </Text>
                {p.developer && (
                  <Text size="xs" c="dimmed" truncate>
                    {p.developer}
                  </Text>
                )}
              </Box>
              <Badge color="green" variant="light" size="sm">
                Active
              </Badge>
            </Group>
          ))
        )}
      </Card>
    </Stack>
  );
}
