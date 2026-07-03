"use client";

import { Badge, Box, Container, Group, Text, ThemeIcon } from "@mantine/core";
import { IconCamera } from "@tabler/icons-react";

// Shell for the secure manage-booking link (opened from email, no login).
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Box component="header" className="app-header" py="sm">
        <Container size="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" variant="filled">
                <IconCamera size={16} stroke={2} />
              </ThemeIcon>
              <Text fw={700}>Springfield RE</Text>
            </Group>
            <Badge variant="default" c="dimmed">
              Manage booking
            </Badge>
          </Group>
        </Container>
      </Box>
      <Container size="sm" py="lg">
        {children}
      </Container>
    </>
  );
}
