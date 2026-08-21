import { redirect } from "next/navigation";
import { Stack, Text, Title } from "@mantine/core";
import { auth } from "@/auth";
import { RenewBatch } from "@/components/registry/RenewBatch";
import { can } from "@/lib/registry/access";

export const dynamic = "force-dynamic";

export default async function RenewPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.roles, "batchRenew")) redirect("/admin/permits");

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Renewals</Title>
        <Text size="sm" c="dimmed">
          Renew many permits at once. Each one is recorded as a new permit, so
          the permit it replaces is kept as history.
        </Text>
      </div>

      <RenewBatch />
    </Stack>
  );
}
