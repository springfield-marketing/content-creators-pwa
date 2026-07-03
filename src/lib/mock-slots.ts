// Deterministic mock availability for the wireframe stage. Stage 2 replaces
// this with real Google Calendar free/busy + booking checks, but the rules it
// demonstrates (working days, time off, minimum notice, booking horizon) are
// the real ones from creator settings.

import dayjs from "dayjs";
import type { Creator } from "./mock-data";

const CANDIDATE_TIMES: [number, number][] = [
  [9, 0],
  [10, 30],
  [13, 0],
  [14, 30],
  [16, 0],
];

// Stable pseudo-random "busy" pattern so the calendar looks realistic and
// renders identically on server and client.
function isBusy(creator: Creator, date: dayjs.Dayjs, slotIndex: number) {
  const seed =
    date.date() * 7 + date.month() * 3 + slotIndex * 5 + creator.slug.length;
  return seed % 3 === 0;
}

export function isDayBookable(creator: Creator, date: dayjs.Dayjs): boolean {
  const { settings, timeOff } = creator;
  const today = dayjs().startOf("day");
  const earliest = dayjs().add(settings.minNoticeHours, "hour").startOf("day");
  const horizon = today.add(settings.horizonWeeks, "week");

  if (date.isBefore(earliest, "day")) return false;
  if (date.isAfter(horizon, "day")) return false;
  if (!settings.workDays.includes(date.day())) return false;
  const d = date.format("YYYY-MM-DD");
  if (timeOff.some((t) => d >= t.from && d <= t.to)) return false;
  return true;
}

export function slotsForDay(creator: Creator, date: dayjs.Dayjs): dayjs.Dayjs[] {
  if (!isDayBookable(creator, date)) return [];
  return CANDIDATE_TIMES.filter(
    (_, i) => !isBusy(creator, date, i)
  ).map(([h, m]) => date.hour(h).minute(m).second(0).millisecond(0));
}

// The next `count` calendar days, for the week-strip view.
export function upcomingDays(count: number): dayjs.Dayjs[] {
  const start = dayjs().startOf("day");
  return Array.from({ length: count }, (_, i) => start.add(i, "day"));
}
