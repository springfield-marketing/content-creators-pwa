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
