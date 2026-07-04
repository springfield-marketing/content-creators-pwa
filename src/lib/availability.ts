// Real availability — the authoritative §B12.3 algorithm.
//
// computeSlots() is pure (all inputs passed in) so the same code path serves
// the availability endpoint now and the booking-transaction re-check in step 7.
// getAvailability() orchestrates: creator + time off + confirmed bookings from
// Postgres, busy blocks from Google FreeBusy, then computeSlots.

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creatorTimeOff, users } from "@/db/schema";
import type { ShootDurations, WorkingHours } from "@/db/schema";
import { freeBusy } from "@/lib/google-calendar";

dayjs.extend(utc);
dayjs.extend(timezone);

// §B10: store UTC, render Asia/Dubai; working hours are Dubai-local.
export const TZ = "Asia/Dubai";
const SLOT_STEP_MIN = 30;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type DbShootType = "photo" | "video" | "photo_video";

export type CreatorSettings = {
  workingHours: WorkingHours;
  shootDurations: ShootDurations;
  bufferMinutes: number;
  minNoticeHours: number;
  maxHorizonDays: number;
  maxShootsPerDay: number;
};

export type Interval = { start: string; end: string }; // ISO datetimes
export type DateRange = { from: string; to: string }; // YYYY-MM-DD (inclusive)

export type Slot = { start: string; end: string; date: string; label: string };

export function computeSlots(params: {
  settings: CreatorSettings;
  shootType: DbShootType;
  timeOff: DateRange[];
  busy: Interval[]; // FreeBusy ∪ confirmed bookings, uninflated
  confirmedPerDay: Record<string, number>; // Dubai date → confirmed count
  now: dayjs.Dayjs;
}): Slot[] {
  const { settings, shootType, timeOff, busy, confirmedPerDay, now } = params;
  const duration = settings.shootDurations[shootType];
  if (!duration) return [];

  // 1. Clamp to [now + min notice, today + horizon].
  const clampStart = now.add(settings.minNoticeHours, "hour");
  const horizonEnd = now.tz(TZ).endOf("day").add(settings.maxHorizonDays, "day");

  // 4-prep. Inflate busy blocks by the buffer on both sides.
  const inflated = busy.map((b) => ({
    start: dayjs(b.start).subtract(settings.bufferMinutes, "minute"),
    end: dayjs(b.end).add(settings.bufferMinutes, "minute"),
  }));

  const slots: Slot[] = [];
  for (
    let day = now.tz(TZ).startOf("day");
    !day.isAfter(horizonEnd);
    day = day.add(1, "day")
  ) {
    const dateStr = day.format("YYYY-MM-DD");

    // 2. Skip time-off dates.
    if (timeOff.some((t) => dateStr >= t.from && dateStr <= t.to)) continue;

    // 5. Skip days already at the per-day cap.
    if ((confirmedPerDay[dateStr] ?? 0) >= settings.maxShootsPerDay) continue;

    // 3. Expand working-hours ranges into candidates (30-min step).
    const ranges = settings.workingHours[DAY_KEYS[day.day()]] ?? [];
    for (const [rangeStart, rangeEnd] of ranges) {
      const windowEnd = dayjs.tz(`${dateStr} ${rangeEnd}`, TZ);
      for (
        let start = dayjs.tz(`${dateStr} ${rangeStart}`, TZ);
        !start.add(duration, "minute").isAfter(windowEnd);
        start = start.add(SLOT_STEP_MIN, "minute")
      ) {
        const end = start.add(duration, "minute");
        if (start.isBefore(clampStart)) continue; // 1. notice clamp
        // 4. Drop candidates intersecting an inflated busy block.
        const collides = inflated.some(
          (b) => start.isBefore(b.end) && end.isAfter(b.start)
        );
        if (collides) continue;
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          date: dateStr,
          label: start.tz(TZ).format("HH:mm"),
        });
      }
    }
  }
  return slots;
}

export class CalendarUnavailableError extends Error {}

export async function getAvailability(slug: string, shootType: DbShootType) {
  const [creator] = await db
    .select({
      id: users.id,
      email: users.googleCalendarId,
      isActive: users.isActive,
      workingHours: users.workingHours,
      shootDurations: users.shootDurations,
      bufferMinutes: users.bufferMinutes,
      minNoticeHours: users.minNoticeHours,
      maxHorizonDays: users.maxHorizonDays,
      maxShootsPerDay: users.maxShootsPerDay,
    })
    .from(users)
    .where(and(eq(users.slug, slug), eq(users.role, "creator")))
    .limit(1);

  if (!creator || !creator.isActive) return null;

  const settings: CreatorSettings = {
    workingHours: creator.workingHours!,
    shootDurations: creator.shootDurations!,
    bufferMinutes: creator.bufferMinutes ?? 30,
    minNoticeHours: creator.minNoticeHours ?? 24,
    maxHorizonDays: creator.maxHorizonDays ?? 28,
    maxShootsPerDay: creator.maxShootsPerDay ?? 3,
  };

  const now = dayjs();
  const windowStart = now.toISOString();
  const windowEnd = now
    .tz(TZ)
    .endOf("day")
    .add(settings.maxHorizonDays, "day")
    .toISOString();

  const timeOff = await db
    .select({ from: creatorTimeOff.startsOn, to: creatorTimeOff.endsOn })
    .from(creatorTimeOff)
    .where(
      and(
        eq(creatorTimeOff.creatorId, creator.id),
        gte(creatorTimeOff.endsOn, now.tz(TZ).format("YYYY-MM-DD"))
      )
    );

  // Confirmed Postgres bookings double as busy blocks (§B5.1: guards
  // against webhook lag) and feed the per-day cap.
  const confirmed = await db
    .select({ start: bookings.startsAt, end: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.creatorId, creator.id),
        eq(bookings.status, "confirmed"),
        lt(bookings.startsAt, new Date(windowEnd)),
        gte(bookings.endsAt, new Date(windowStart))
      )
    );

  const confirmedPerDay: Record<string, number> = {};
  for (const b of confirmed) {
    const d = dayjs(b.start).tz(TZ).format("YYYY-MM-DD");
    confirmedPerDay[d] = (confirmedPerDay[d] ?? 0) + 1;
  }

  let googleBusy: Interval[];
  try {
    googleBusy = await freeBusy(creator.email!, windowStart, windowEnd);
  } catch {
    // §B10 graceful degradation: never show slots we can't verify.
    throw new CalendarUnavailableError();
  }

  const slots = computeSlots({
    settings,
    shootType,
    timeOff,
    busy: [
      ...googleBusy,
      ...confirmed.map((b) => ({
        start: b.start.toISOString(),
        end: b.end.toISOString(),
      })),
    ],
    confirmedPerDay,
    now,
  });

  return {
    timeZone: TZ,
    shootType,
    durationMinutes: settings.shootDurations[shootType],
    horizonDays: settings.maxHorizonDays,
    slots,
  };
}
