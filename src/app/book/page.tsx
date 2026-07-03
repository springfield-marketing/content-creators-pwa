"use client";

import Link from "next/link";
import {
  Avatar,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { creators } from "@/lib/mock-data";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("");

// Screen 1 — Booking home: active creators as tappable cards.
export default function BookHome() {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>Book a shoot</Title>
        <Text c="dimmed" size="sm">
          Pick a content creator to see their available times.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        {creators
          .filter((c) => c.active)
          .map((creator) => (
            <Card
              key={creator.id}
              component={Link}
              href={`/book/${creator.slug}`}
              className="hover-card"
            >
              <Group wrap="nowrap">
                {/* Placeholder avatar — real photos come with branding */}
                <Avatar color={creator.color} radius="xl" size="lg">
                  {initials(creator.name)}
                </Avatar>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600}>{creator.name}</Text>
                  <Text size="xs" c="dimmed">
                    Photo &amp; video shoots
                  </Text>
                </Stack>
                <IconChevronRight
                  size={18}
                  color="var(--mantine-color-dimmed)"
                />
              </Group>
            </Card>
          ))}
      </SimpleGrid>
    </Stack>
  );
}
