import { Group, Skeleton, Stack } from "@mantine/core";

// Shown while availability loads (live calendar check in stage 2).
export default function Loading() {
  return (
    <Stack gap="md">
      <Group>
        <Skeleton height={56} width={56} circle />
        <Skeleton height={28} width={180} />
      </Group>
      <Skeleton height={36} radius="md" />
      <Skeleton height={64} radius="md" />
      <Skeleton height={120} radius="lg" />
    </Stack>
  );
}
