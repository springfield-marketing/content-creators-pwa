// POST /api/webhooks/google-calendar — §B5.4 sync-back for changes made
// directly in Google Calendar. ACTIVATES AT DEPLOYMENT: watch channels need
// a public HTTPS URL (see src/lib/setup-watch-channels.ts).
//
// Notifications carry no payload — on each ping we run an incremental sync
// (events.list with the stored syncToken) for that creator. Idempotent:
// Google retries, and re-processing an already-synced event is a no-op.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { calendarFor } from "@/lib/google-calendar";
import { cancelBooking } from "@/lib/booking-actions";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const channelId = req.headers.get("x-goog-channel-id");
  const channelToken = req.headers.get("x-goog-channel-token");
  const state = req.headers.get("x-goog-resource-state");

  // Authenticity: the token was set by us at watch time (§B5.4).
  if (!channelId || channelToken !== process.env.WEBHOOK_CHANNEL_TOKEN) {
    return NextResponse.json({ ok: true }); // never reveal validity
  }
  if (state === "sync") return NextResponse.json({ ok: true }); // handshake

  const [creator] = await db
    .select({
      id: users.id,
      email: users.googleCalendarId,
      syncToken: users.calendarSyncToken,
    })
    .from(users)
    .where(eq(users.webhookChannelId, channelId))
    .limit(1);
  if (!creator?.email) return NextResponse.json({ ok: true });

  const calendar = calendarFor(creator.email);
  let pageToken: string | undefined;
  const syncToken = creator.syncToken ?? undefined;
  let nextSyncToken: string | undefined;

  try {
    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        syncToken,
        pageToken,
        maxResults: 100,
        ...(syncToken ? {} : { timeMin: new Date().toISOString() }),
      });
      for (const ev of res.data.items ?? []) {
        const bookingId = ev.extendedProperties?.private?.bookingId;
        const isOurs = ev.extendedProperties?.private?.app === "contentapp";
        if (!bookingId || !isOurs) continue; // personal events: ignored

        const [b] = await db
          .select({
            id: bookings.id,
            status: bookings.status,
            start: bookings.startsAt,
            end: bookings.endsAt,
            agentDeclined: bookings.agentDeclined,
          })
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .limit(1);
        if (!b) continue;

        // Deleted/cancelled in Google Calendar → cancel the booking (§B5.4).
        if (ev.status === "cancelled" && b.status === "confirmed") {
          await cancelBooking({
            bookingId: b.id,
            cancelledBy: "creator",
            reason: "Cancelled via calendar",
          });
          continue;
        }

        // Time changed in Google Calendar → follow it; a later end than
        // booked end after completion is captured as overtime elsewhere.
        const newStart = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
        const newEnd = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
        if (
          newStart && newEnd && b.status === "confirmed" &&
          (newStart.getTime() !== b.start.getTime() ||
            newEnd.getTime() !== b.end.getTime())
        ) {
          await db
            .update(bookings)
            .set({ startsAt: newStart, endsAt: newEnd, updatedAt: new Date() })
            .where(eq(bookings.id, b.id));
          await logAudit({
            entity: "booking",
            entityId: b.id,
            action: "synced_time_change",
            diff: { start: newStart.toISOString(), end: newEnd.toISOString() },
          });
        }

        // §B12.1: attendee decline flags for follow-up, never auto-cancels.
        const declined = (ev.attendees ?? []).some(
          (a) => a.responseStatus === "declined"
        );
        if (declined && !b.agentDeclined) {
          await db
            .update(bookings)
            .set({ agentDeclined: true })
            .where(eq(bookings.id, b.id));
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
    } while (pageToken);
  } catch (e) {
    // 410 = sync token expired: clear it; next ping does a fresh window sync.
    if ((e as { code?: number }).code === 410) {
      await db
        .update(users)
        .set({ calendarSyncToken: null })
        .where(eq(users.id, creator.id));
      return NextResponse.json({ ok: true });
    }
    console.error("Webhook sync failed:", e);
    return NextResponse.json({ ok: true }); // ack anyway; Google retries
  }

  if (nextSyncToken) {
    await db
      .update(users)
      .set({ calendarSyncToken: nextSyncToken })
      .where(eq(users.id, creator.id));
  }
  return NextResponse.json({ ok: true });
}
