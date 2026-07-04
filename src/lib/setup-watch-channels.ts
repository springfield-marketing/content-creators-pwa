// Post-deployment: open (or renew) a Google Calendar watch channel per
// creator (§B5.4). Requires a public HTTPS APP_URL and WEBHOOK_CHANNEL_TOKEN.
// Run: npx tsx --env-file=.env src/lib/setup-watch-channels.ts
// Re-running renews channels expiring within 48h. Schedule daily.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { calendarFor } from "@/lib/google-calendar";

async function main() {
  const appUrl = process.env.APP_URL;
  const token = process.env.WEBHOOK_CHANNEL_TOKEN;
  if (!appUrl?.startsWith("https://") || !token) {
    console.error(
      "Set APP_URL (public https) and WEBHOOK_CHANNEL_TOKEN in .env first — webhooks can't run on localhost."
    );
    process.exit(1);
  }

  const creators = await db
    .select({
      id: users.id,
      email: users.googleCalendarId,
      expires: users.webhookExpiresAt,
    })
    .from(users)
    .where(eq(users.role, "creator"));

  const cutoff = Date.now() + 48 * 3600 * 1000;
  for (const c of creators) {
    if (!c.email) continue;
    if (c.expires && c.expires.getTime() > cutoff) {
      console.log(`✓ ${c.email}: channel healthy until ${c.expires.toISOString()}`);
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
    console.log(`↻ ${c.email}: channel opened (${channelId})`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
