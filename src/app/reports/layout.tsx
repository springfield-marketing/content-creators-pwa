"use client";

import Image from "next/image";
import { Badge, Box, Container, Group, Text } from "@mantine/core";

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
              <Image
                src="/S LOGO-Blue.png"
                alt="Springfield Properties"
                width={26}
                height={26}
              />
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
