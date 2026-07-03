import { Skeleton, Stack } from "@mantine/core";

// Shown while admin screens fetch data (real queries arrive in stage 2).
export default function Loading() {
  return (
    <Stack gap="md">
      <Skeleton height={32} width={240} />
      <Skeleton height={80} radius="lg" />
      <Skeleton height={80} radius="lg" />
      <Skeleton height={80} radius="lg" />
    </Stack>
  );
}
