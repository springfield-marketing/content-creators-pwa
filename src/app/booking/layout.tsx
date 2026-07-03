"use client";

import Image from "next/image";
import { Badge, Box, Container, Group } from "@mantine/core";

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
            <Image
              src="/Springfield Properties Logo.png"
              alt="Springfield Properties"
              width={128}
              height={30}
              className="brand-logo"
              priority
            />
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
