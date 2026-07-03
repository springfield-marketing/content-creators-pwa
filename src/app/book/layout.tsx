"use client";

import Link from "next/link";
import Image from "next/image";
import { Anchor, Box, Container, Group, Text } from "@mantine/core";

// Public agent-facing shell: branded header, phone-first width.
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
            <Anchor component={Link} href="/book" underline="never">
              <Image
                src="/Springfield Properties Logo.png"
                alt="Springfield Properties"
                width={128}
                height={30}
                className="brand-logo"
                priority
              />
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
