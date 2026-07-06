"use client";

// Content Creation Shooting Guidelines (agent-facing).
// Shown collapsed on the booking form and expanded on the confirmation
// screen — visible on every booking without interrupting the flow.

import { Accordion, Card, List, Stack, Text } from "@mantine/core";
import { IconClipboardList } from "@tabler/icons-react";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. Script preparation",
    items: [
      "Arrive fully prepared with a complete script. Unprepared agents may be reported and face fewer future booking opportunities.",
    ],
  },
  {
    title: "2. QR code requirement",
    items: [
      "Valid QR code required per Dubai/Abu Dhabi media permit rules — no QR code, no shoot.",
    ],
  },
  {
    title: "3. Dress code & grooming",
    items: [
      "Business attire only.",
      "Men: suit or formal business wear.",
      "Women: suit, dress, or formal business attire (no sleeveless tops, short skirts, or casual wear).",
      "Be well-groomed and wear the Springfield badge at all times.",
    ],
  },
  {
    title: "4. Video format",
    items: ["Long-format videos require prior management approval."],
  },
  {
    title: "5. Cancellations",
    items: [
      "Cancel at least 24 hours before the shoot using your company/Springfield email and Google Calendar. Late cancellations may affect future booking opportunities.",
    ],
  },
  {
    title: "6. Content tagging",
    items: [
      "Tag the Springfield page (@springfielduae) and the content creator who filmed your video (standard tag only) after upload.",
    ],
  },
  {
    title: "7. Conduct",
    items: [
      "Only attend shoots if fully prepared.",
      "Do not access creators' phones or raw materials.",
      "Coordinate additional footage with the videographer on personal devices.",
      "Never post or share content without the company logo.",
    ],
  },
];

function GuidelinesBody() {
  return (
    <Stack gap="sm">
      {SECTIONS.map((s) => (
        <div key={s.title}>
          <Text size="sm" fw={600}>
            {s.title}
          </Text>
          {s.items.length === 1 ? (
            <Text size="sm" c="dimmed">
              {s.items[0]}
            </Text>
          ) : (
            <List size="sm" c="dimmed" spacing={2}>
              {s.items.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          )}
        </div>
      ))}
    </Stack>
  );
}

export function ShootingGuidelines({
  variant,
}: {
  variant: "accordion" | "card";
}) {
  if (variant === "card") {
    return (
      <Card w="100%" maw={480} ta="left">
        <Stack gap="sm">
          <Text fw={600}>Before your shoot — the rules</Text>
          <GuidelinesBody />
        </Stack>
      </Card>
    );
  }

  return (
    <Accordion variant="contained" radius="md">
      <Accordion.Item value="guidelines">
        <Accordion.Control icon={<IconClipboardList size={18} />}>
          <Text size="sm" fw={500}>
            Shooting guidelines — please read before your shoot
          </Text>
        </Accordion.Control>
        <Accordion.Panel>
          <GuidelinesBody />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
