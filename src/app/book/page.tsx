"use client";

import Link from "next/link";
import {
  Alert,
  Avatar,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { avatarColor, useCreators } from "@/lib/use-creator";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Screen 1 — Booking home: active creators as tappable cards.
export default function BookHome() {
  const { creators, error } = useCreators();

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>Book a shoot</Title>
        <Text c="dimmed" size="sm">
          Pick a content creator to see their available times.
        </Text>
      </Stack>

      {error ? (
        <Alert color="red" variant="light">
          Couldn&apos;t load the creator list — try refreshing.
        </Alert>
      ) : creators === null ? (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={88} radius="lg" />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          {creators.map((creator) => (
            <Card
              key={creator.id}
              component={Link}
              href={`/book/${creator.slug}`}
              className="hover-card"
            >
              <Group wrap="nowrap">
                {/* Placeholder avatar — real photos come with branding */}
                <Avatar color={avatarColor(creator.name)} radius="xl" size="lg">
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
      )}
    </Stack>
  );
}
