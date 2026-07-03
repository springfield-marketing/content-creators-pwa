"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Alert,
  Anchor,
  Button,
  Card,
  Center,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconBrandGoogleFilled } from "@tabler/icons-react";

// Staff login. Agents never sign in — they book via the public /book flow.
function Login() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <Center mih="100dvh" p="md">
      <Card w={400} maw="100%" padding="xl">
        <Stack gap="lg" align="center">
          <Image
            src="/Springfield Properties Logo.png"
            alt="Springfield Properties"
            width={180}
            height={42}
            className="brand-logo"
            priority
          />
          <Stack gap={4} ta="center">
            <Title order={2}>Content Team</Title>
            <Text size="sm" c="dimmed">
              Sign in with your company Google account.
            </Text>
          </Stack>

          {error && (
            <Alert color="red" variant="light" w="100%">
              {error === "AccessDenied"
                ? "This Google account isn't on the content team. Ask the manager to add you."
                : "Sign-in failed — please try again."}
            </Alert>
          )}

          <Button
            size="md"
            fullWidth
            leftSection={<IconBrandGoogleFilled size={18} />}
            onClick={() => signIn("google", { callbackUrl })}
          >
            Sign in with Google
          </Button>

          <Text size="xs" c="dimmed" ta="center">
            Booking a shoot as an agent? No account needed —{" "}
            <Anchor component={Link} href="/book" size="xs">
              book here
            </Anchor>
            .
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
