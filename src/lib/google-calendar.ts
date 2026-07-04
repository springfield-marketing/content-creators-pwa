// Google Calendar client via service account + domain-wide delegation
// (§B3 Option A). calendarFor(email) returns a client acting AS that user,
// so free/busy reads and event writes happen on their own calendar.

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const KEY_PATH = path.join(process.cwd(), "google-service-account.local.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

let key: { client_email: string; private_key: string } | null = null;

function loadKey() {
  if (!key) {
    if (!fs.existsSync(KEY_PATH)) {
      throw new Error(
        "Service account key missing — expected google-service-account.local.json in the project root."
      );
    }
    key = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  }
  return key!;
}

export function calendarFor(userEmail: string) {
  const { client_email, private_key } = loadKey();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: SCOPES,
    subject: userEmail, // impersonation via domain-wide delegation
  });
  return google.calendar({ version: "v3", auth });
}

// Creates the booking event on the creator's calendar (§B5.2). The agent is
// an attendee and sendUpdates=all, so Google emails them a standard invite
// that works across Google/Outlook/Apple. Returns the Google event id.
export async function insertBookingEvent(params: {
  creatorEmail: string;
  bookingId: string;
  summary: string;
  description: string;
  location: string;
  startIso: string;
  endIso: string;
  agentEmail: string | null;
  timeZone: string;
}): Promise<string> {
  const calendar = calendarFor(params.creatorEmail);
  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      location: params.location,
      description: params.description,
      start: { dateTime: params.startIso, timeZone: params.timeZone },
      end: { dateTime: params.endIso, timeZone: params.timeZone },
      attendees: params.agentEmail ? [{ email: params.agentEmail }] : [],
      extendedProperties: {
        private: { bookingId: params.bookingId, app: "contentapp" },
      },
      reminders: { useDefault: true },
    },
  });
  if (!res.data.id) throw new Error("Calendar event created without an id");
  return res.data.id;
}

// Removes a booking's event (cancellation); attendees are notified by Google.
export async function deleteBookingEvent(
  creatorEmail: string,
  eventId: string
): Promise<void> {
  const calendar = calendarFor(creatorEmail);
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
    sendUpdates: "all",
  });
}

// Busy blocks for one user over a window (§B5.1 step 1).
export async function freeBusy(
  userEmail: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const calendar = calendarFor(userEmail);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: userEmail }],
    },
  });
  const busy = res.data.calendars?.[userEmail]?.busy ?? [];
  return busy.map((b) => ({ start: b.start!, end: b.end! }));
}
