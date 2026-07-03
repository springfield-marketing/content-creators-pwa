"use client";

import Link from "next/link";
import { Anchor, Box, Container, Group, Text, ThemeIcon } from "@mantine/core";
import { IconCamera } from "@tabler/icons-react";

// Public agent-facing shell: minimal branded header, phone-first width.
export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Box component="header" className="app-header" py="sm">
        <Container size="sm">
          <Group justify="space-between">
            <Anchor component={Link} href="/book" underline="never" c="inherit">
              <Group gap="xs">
                <ThemeIcon size="md" radius="md" variant="filled">
                  <IconCamera size={16} stroke={2} />
                </ThemeIcon>
                <Text fw={700}>Springfield RE</Text>
              </Group>
            </Anchor>
            <Text size="sm" c="dimmed">
              Book a shoot
            </Text>
          </Group>
        </Container>
      </Box>
      <Container size="sm" py="lg">
        {children}
      </Container>
    </>
  );
}
