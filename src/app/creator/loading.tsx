import { Skeleton, Stack } from "@mantine/core";

// Shown while the creator's schedule/progress loads (stage 2).
export default function Loading() {
  return (
    <Stack gap="md">
      <Skeleton height={32} width={160} />
      <Skeleton height={120} radius="lg" />
      <Skeleton height={120} radius="lg" />
    </Stack>
  );
}
