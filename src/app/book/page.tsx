"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { avatarColor, useCreators } from "@/lib/use-creator";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Screen 1 — Booking home: photo cards, tap a creator to pick a time.
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
        <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="md">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={220} radius="lg" />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 2, xs: 3 }} spacing="md">
          {creators.map((creator) => (
            <Card
              key={creator.id}
              component={Link}
              href={`/book/${creator.slug}`}
              className="hover-card"
              padding={0}
            >
              <div style={{ position: "relative", aspectRatio: "4 / 5" }}>
                {creator.branch && (
                  <Badge
                    variant="default"
                    size="sm"
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      zIndex: 1,
                    }}
                  >
                    {creator.branch}
                  </Badge>
                )}
                {creator.photoUrl ? (
                  <Image
                    src={encodeURI(creator.photoUrl)}
                    alt={creator.name}
                    fill
                    sizes="(max-width: 576px) 50vw, 200px"
                    style={{ objectFit: "cover", objectPosition: "top" }}
                  />
                ) : (
                  <Avatar
                    color={avatarColor(creator.name)}
                    radius={0}
                    styles={{
                      root: {
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      },
                    }}
                  >
                    {initials(creator.name)}
                  </Avatar>
                )}
              </div>
              <Text fw={600} size="sm" ta="center" py="sm" px={4}>
                {creator.name}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
