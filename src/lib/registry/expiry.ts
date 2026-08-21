import { daysUntil } from "./permit-status";

/** Widest first is only for reading; bucketing walks these ascending. */
export const ALERT_DAYS = [7, 14, 30, 60] as const;

export type ExpiringProject = {
  id: number;
  name: string;
  dldProjectNumber: string | null;
  permitNumber: string | null;
  listingEnd: string | null;
};

export type ExpiryReport = {
  expired: ExpiringProject[];
  dueIn: Record<number, ExpiringProject[]>;
  total: number;
};

/**
 * Splits projects into an expired list and one bucket per alert threshold.
 *
 * A permit lands in the tightest bucket it fits, so nothing is reported four
 * times as it counts down.
 */
export function bucketByExpiry(
  projects: ExpiringProject[],
  today: string,
): ExpiryReport {
  const expired: ExpiringProject[] = [];
  const dueIn: Record<number, ExpiringProject[]> = {};
  for (const d of ALERT_DAYS) dueIn[d] = [];

  for (const p of projects) {
    if (!p.listingEnd) continue;
    const days = daysUntil(p.listingEnd, today);
    if (days < 0) {
      expired.push(p);
      continue;
    }
    const bucket = ALERT_DAYS.find((d) => days <= d);
    if (bucket !== undefined) dueIn[bucket].push(p);
  }

  const bySoonest = (a: ExpiringProject, b: ExpiringProject) =>
    (a.listingEnd ?? "").localeCompare(b.listingEnd ?? "");
  expired.sort(bySoonest);
  for (const d of ALERT_DAYS) dueIn[d].sort(bySoonest);

  return {
    expired,
    dueIn,
    total: expired.length + ALERT_DAYS.reduce((n, d) => n + dueIn[d].length, 0),
  };
}
