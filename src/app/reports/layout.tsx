"use client";

import { Badge, Box, Container, Group, Text, ThemeIcon } from "@mantine/core";
import { IconReportAnalytics } from "@tabler/icons-react";

// Management shell: read-only, minimal chrome.
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Box component="header" className="app-header" py="sm">
        <Container size="lg">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" variant="filled">
                <IconReportAnalytics size={16} stroke={2} />
              </ThemeIcon>
              <Text fw={700}>Content Team · Reports</Text>
            </Group>
            <Badge variant="default" c="dimmed">
              View only
            </Badge>
          </Group>
        </Container>
      </Box>
      <Container size="lg" py="lg">
        {children}
      </Container>
    </>
  );
}
