// One-off historical import: July 2026 raw calendar sheet → bookings.
// Bookings-only, no agent links (per decision), no new calendar events
// (events already exist — their IDs are linked). Reversible: every row is
// tagged IMPORT_TAG in notes.
//
// Dry run (default):  npx tsx --env-file=.env scripts/import-july-sheet.ts
// Commit to DB:       CONFIRM=1 DATABASE_URL='<direct-neon>' npx tsx scripts/import-july-sheet.ts
// Undo:               UNDO=1 DATABASE_URL='<direct-neon>' npx tsx scripts/import-july-sheet.ts

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParse from "dayjs/plugin/customParseFormat";
import { arrayContains, like } from "drizzle-orm";
import { db } from "../src/db";
import { bookings, users } from "../src/db/schema";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParse);

const TZ = "Asia/Dubai";
const IMPORT_TAG = "[imported:july-2026-sheet]";
const CSV = path.join(process.cwd(), "Content Creator Calendars - Raw Data - July 2026.csv");

const CREATOR_NAME_MAP: Record<string, string> = {
  "Aung Ko Phyo": "Aung Ko Phyo",
  "Bruce Zay Yar Min": "Zay Yar Min",
  "Chan Myae Thu": "Chan Myae Thu",
  "Charles Bonifacio": "Charles Bonifacio",
  "Jericho Ramos": "Jericho Ramos",
  "Kyaw Soe Han": "Kyaw Soe Han",
  "Philip Lim": "Philip Winston Lim",
  "Sean Chase Reyes": "Sean Chase Reyes Laihee",
  "Syed Ahmed": "Ahmed Syed",
};

const TIME_BLOCKS: Record<string, [string, string]> = {
  "10:30 AM – 01:30 PM": ["10:30", "13:30"],
  "04:00 PM – 07:00 PM": ["16:00", "19:00"],
};

function mapType(raw: string): "photo" | "video" | null {
  const t = raw.trim().toLowerCase();
  if (!t || t === "n/a" || t === "na") return null;
  if (t.includes("offset") || t.includes("editing")) return null;
  if (t.includes("photo")) return "photo";
  return "video"; // dominant real activity type here
}

function isOffice(loc: string): boolean {
  const l = loc.trim().toLowerCase();
  return ["office", "in the office", "in-office", "n/a", "na", ""].includes(l);
}

async function undo() {
  const removed = await db
    .delete(bookings)
    .where(like(bookings.notes, `%${IMPORT_TAG}%`))
    .returning({ id: bookings.id });
  console.log(`Removed ${removed.length} previously-imported bookings.`);
  process.exit(0);
}

async function main() {
  if (process.env.UNDO === "1") return undo();

  const rows: Record<string, string>[] = parse(fs.readFileSync(CSV), {
    columns: true,
    skip_empty_lines: true,
  });

  const creators = await db
    .select({ id: users.id, name: users.fullName, email: users.googleCalendarId })
    .from(users)
    .where(arrayContains(users.roles, ["creator"]));
  const creatorByName = new Map(creators.map((c) => [c.name, c]));

  const toInsert: (typeof bookings.$inferInsert)[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    const type = mapType(r["Shoot Type"]);
    if (!type) {
      skipped.push(`${r.Date} ${r.Creator} — ${r["Shoot Type"] || "(blank)"}`);
      continue;
    }
    const appName = CREATOR_NAME_MAP[r.Creator];
    const creator = appName ? creatorByName.get(appName) : undefined;
    if (!creator) {
      skipped.push(`${r.Date} ${r.Creator} — creator not matched`);
      continue;
    }
    const block = TIME_BLOCKS[r.Time.trim()];
    if (!block) {
      skipped.push(`${r.Date} ${r.Creator} — time '${r.Time}'`);
      continue;
    }
    const date = dayjs(r.Date, "DD-MMM-YYYY").format("YYYY-MM-DD");
    const start = dayjs.tz(`${date} ${block[0]}`, TZ);
    const end = dayjs.tz(`${date} ${block[1]}`, TZ);
    const status = r.Status.trim().toLowerCase() === "cancelled" ? "cancelled" : "completed";

    // Project column is inconsistent (real names, but also leaked "Yes"/"No"
    // and n/a). Use it only when it looks meaningful; else the shoot title.
    const projRaw = r.Project?.trim() ?? "";
    const projJunk = ["n/a", "na", "yes", "no", ""].includes(projRaw.toLowerCase());
    const project = !projJunk
      ? projRaw
      : r["Shoot Title"].trim() || `Shoot for ${r.Agent.trim()}`;

    const notes = [
      IMPORT_TAG,
      `Agent (unlinked): ${r.Agent.trim()}${r.Email ? ` <${r.Email.trim()}>` : ""}`,
      r.Phone?.trim() ? `Phone: ${r.Phone.trim()}` : null,
      `Original type: ${r["Shoot Type"].trim()}`,
      r["Shooting Location"]?.trim() ? `Location note: ${r["Shooting Location"].trim()}` : null,
      r["QR Code"]?.trim() && !["n/a", "na"].includes(r["QR Code"].trim().toLowerCase())
        ? `QR: ${r["QR Code"].trim()}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    toInsert.push({
      creatorId: creator.id,
      agentId: null,
      source: "manual",
      shootType: type,
      locationType: isOffice(r["Shooting Location"]) ? "office" : "on_site",
      propertyAddress: isOffice(r["Shooting Location"]) ? null : r["Shooting Location"].trim(),
      projectName: project.slice(0, 200),
      notes,
      startsAt: start.toDate(),
      endsAt: end.toDate(),
      status,
      cancelledBy: status === "cancelled" ? "agent" : null,
      cancelledAt: status === "cancelled" ? start.toDate() : null,
      googleEventId: r["Event ID"]?.includes("@google.com") ? r["Event ID"].trim() : null,
      googleCalendarId: creator.email,
    });
  }

  console.log(`\n=== July sheet import (${process.env.CONFIRM === "1" ? "COMMIT" : "DRY RUN"}) ===`);
  console.log(`Will insert: ${toInsert.length}`);
  console.log(`  completed: ${toInsert.filter((b) => b.status === "completed").length}`);
  console.log(`  cancelled: ${toInsert.filter((b) => b.status === "cancelled").length}`);
  const byCreator = new Map<string, number>();
  for (const b of toInsert) {
    const n = creators.find((c) => c.id === b.creatorId)!.name;
    byCreator.set(n, (byCreator.get(n) ?? 0) + 1);
  }
  console.log("  by creator:", Object.fromEntries([...byCreator]));
  console.log(`\nSkipped: ${skipped.length}`);
  skipped.forEach((s) => console.log("  -", s));
  console.log("\nSample of first 3 to insert:");
  toInsert.slice(0, 3).forEach((b) =>
    console.log(`  ${dayjs(b.startsAt).tz(TZ).format("D MMM HH:mm")} ${creators.find((c) => c.id === b.creatorId)!.name} · ${b.shootType} · ${b.status} · "${b.projectName}"`)
  );

  if (process.env.CONFIRM !== "1") {
    console.log("\nDRY RUN — nothing written. Re-run with CONFIRM=1 to commit.");
    process.exit(0);
  }

  await db.insert(bookings).values(toInsert);
  console.log(`\n✅ Inserted ${toInsert.length} bookings.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
