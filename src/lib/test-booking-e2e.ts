// End-to-end booking test (dev only). Uses a temporary creator whose
// calendar is the developer's own account, so no real staff get invites.
// Run: npx tsx --env-file=.env src/lib/test-booking-e2e.ts

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog, bookings, users } from "@/db/schema";
import { calendarFor } from "@/lib/google-calendar";

const BASE = "http://localhost:3000";
const DEV_EMAIL = "zed@springfield-re.com";
const SLUG = "e2e-test-studio";

async function cleanup(creatorId?: string, agentId?: string) {
  if (creatorId) {
    const rows = await db
      .select({ id: bookings.id, eventId: bookings.googleEventId })
      .from(bookings)
      .where(eq(bookings.creatorId, creatorId));
    for (const r of rows) {
      if (r.eventId) {
        try {
          const cal = calendarFor(DEV_EMAIL);
          await cal.events.delete({
            calendarId: "primary",
            eventId: r.eventId,
            sendUpdates: "none",
          });
          console.log("  cleaned calendar event", r.eventId);
        } catch {
          console.log("  (event already gone)");
        }
      }
      await db.delete(auditLog).where(eq(auditLog.entityId, r.id));
      await db.delete(bookings).where(eq(bookings.id, r.id));
    }
    await db.delete(users).where(eq(users.id, creatorId));
  }
  if (agentId) await db.delete(agents).where(eq(agents.id, agentId));
}

async function main() {
  // Fresh test fixtures
  await db.delete(users).where(eq(users.slug, SLUG));
  await db.delete(agents).where(eq(agents.email, DEV_EMAIL));

  const [creator] = await db
    .insert(users)
    .values({
      email: `${SLUG}@example.invalid`,
      fullName: "E2E Test Studio",
      role: "creator",
      slug: SLUG,
      googleCalendarId: DEV_EMAIL,
    })
    .returning({ id: users.id });
  const [agent] = await db
    .insert(agents)
    .values({ fullName: "E2E Test Agent", email: DEV_EMAIL })
    .returning({ id: agents.id });
  console.log("fixtures created");

  try {
    // 1. Get a real slot
    const avail = await fetch(
      `${BASE}/api/creators/${SLUG}/availability?type=photo`
    ).then((r) => r.json());
    const slot = avail.slots[0];
    if (!slot) throw new Error("no slots available for test creator");
    console.log("1. picked slot:", slot.date, slot.label);

    // 2. Book it
    const payload = {
      creatorSlug: SLUG,
      shootType: "photo",
      start: slot.start,
      agentId: agent.id,
      projectName: "E2E test — ignore",
      locationType: "office" as const,
    };
    const res = await fetch(`${BASE}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (res.status !== 201) throw new Error(`expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    console.log("2. booked ✅ id:", body.id);
    console.log("   manage URL:", body.manageUrl.slice(0, 60) + "…");

    // 3. Verify DB row + event on the real calendar
    const [row] = await db
      .select({ eventId: bookings.googleEventId, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, body.id));
    if (!row?.eventId) throw new Error("no google_event_id stored");
    const cal = calendarFor(DEV_EMAIL);
    const ev = await cal.events.get({ calendarId: "primary", eventId: row.eventId });
    console.log("3. calendar event ✅", {
      summary: ev.data.summary,
      start: ev.data.start?.dateTime,
      attendees: ev.data.attendees?.map((a) => a.email),
      marker: ev.data.extendedProperties?.private,
    });

    // 4. Double-book the same slot → must be rejected
    const res2 = await fetch(`${BASE}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body2 = await res2.json();
    console.log(
      res2.status === 409
        ? `4. double-booking rejected ✅ (${body2.error})`
        : `4. ❌ expected 409, got ${res2.status}`
    );

    // 5. Slot gone from availability
    const avail2 = await fetch(
      `${BASE}/api/creators/${SLUG}/availability?type=photo`
    ).then((r) => r.json());
    const stillThere = avail2.slots.some((s: { start: string }) => s.start === slot.start);
    console.log(stillThere ? "5. ❌ slot still offered" : "5. slot removed from availability ✅");
  } finally {
    console.log("cleaning up…");
    await cleanup(creator.id, agent.id);
    console.log("done");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
