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
import { IconArrowRight, IconBrandGoogleFilled } from "@tabler/icons-react";

// Staff login. Agents never sign in — they book via the public /book flow.
function Login({ moved }: { moved: boolean }) {
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
          {moved ? (
            <Stack gap="sm" w="100%">
              <Stack gap={4} ta="center">
                <Title order={2}>Booking has moved</Title>
                <Text size="sm" c="dimmed">
                  Agents book shoots in the Calls app. Creators use the Booking App.
                </Text>
              </Stack>
              <Button component="a" href="/book" size="md" fullWidth rightSection={<IconArrowRight size={18} />}>
                Book a shoot in the Calls app
              </Button>
              <Button component="a" href="/creator" size="md" fullWidth variant="light" rightSection={<IconArrowRight size={18} />}>
                Creators: Booking App
              </Button>
              <Text size="sm" c="dimmed" ta="center" mt="sm">
                Permits are still here: sign in with your company Google account.
              </Text>
            </Stack>
          ) : (
            <Stack gap={4} ta="center">
              <Title order={2}>Content Team</Title>
              <Text size="sm" c="dimmed">
                Sign in with your company Google account.
              </Text>
            </Stack>
          )}

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
            variant={moved ? "default" : "filled"}
            leftSection={<IconBrandGoogleFilled size={18} />}
            onClick={() => signIn("google", { callbackUrl })}
          >
            Sign in with Google
          </Button>

          {!moved && (
          <Text size="xs" c="dimmed" ta="center">
            Booking a shoot as an agent? No account needed —{" "}
            <Anchor component={Link} href="/book" size="xs">
              book here
            </Anchor>
            .
          </Text>
          )}
        </Stack>
      </Card>
    </Center>
  );
}

export function LoginForm({ moved }: { moved: boolean }) {
  return (
    <Suspense>
      <Login moved={moved} />
    </Suspense>
  );
}
