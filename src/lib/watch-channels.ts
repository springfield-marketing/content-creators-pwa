// Google Calendar watch channels (§B5.4): open one per creator; renew when
// within 48h of expiry. Requires a public HTTPS APP_URL + WEBHOOK_CHANNEL_TOKEN.

import { randomUUID } from "node:crypto";
import { arrayContains, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { calendarFor } from "@/lib/google-calendar";

export async function renewWatchChannels(): Promise<{
  opened: number;
  healthy: number;
  skipped?: string;
}> {
  const appUrl = process.env.APP_URL;
  const token = process.env.WEBHOOK_CHANNEL_TOKEN;
  if (!appUrl?.startsWith("https://") || !token) {
    return {
      opened: 0,
      healthy: 0,
      skipped: "APP_URL (public https) and WEBHOOK_CHANNEL_TOKEN not set — webhooks inactive.",
    };
  }

  const creators = await db
    .select({
      id: users.id,
      email: users.googleCalendarId,
      expires: users.webhookExpiresAt,
    })
    .from(users)
    .where(arrayContains(users.roles, ["creator"]));

  const cutoff = Date.now() + 48 * 3600 * 1000;
  let opened = 0;
  let healthy = 0;
  for (const c of creators) {
    if (!c.email) continue;
    if (c.expires && c.expires.getTime() > cutoff) {
      healthy++;
      continue;
    }
    const channelId = randomUUID();
    const calendar = calendarFor(c.email);
    const res = await calendar.events.watch({
      calendarId: "primary",
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: `${appUrl}/api/webhooks/google-calendar`,
        token,
      },
    });
    await db
      .update(users)
      .set({
        webhookChannelId: channelId,
        webhookResourceId: res.data.resourceId ?? null,
        webhookExpiresAt: res.data.expiration
          ? new Date(Number(res.data.expiration))
          : null,
        calendarSyncToken: null, // fresh sync baseline
      })
      .where(eq(users.id, c.id));
    opened++;
  }
  return { opened, healthy };
}
