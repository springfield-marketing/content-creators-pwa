export type PermitStatus = "active" | "expiring" | "expired" | "none";

export const EXPIRING_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** Whole calendar days from `today` to `date`, both `yyyy-mm-dd`. */
export function daysUntil(date: string, today: string): number {
  // Date-only strings parse as UTC midnight, so no timezone or DST offset can
  // push the difference off a whole number of days.
  return Math.round(
    (Date.parse(date) - Date.parse(today)) / DAY_MS,
  );
}

/**
 * Derived at read time from the permit's end date — never stored, so it cannot
 * drift out of date the way the source sheet's status column did.
 */
export function permitStatus(
  listingEnd: string | null,
  today: string,
): PermitStatus {
  if (!listingEnd) return "none";
  const days = daysUntil(listingEnd, today);
  if (days < 0) return "expired";
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "active";
}

export const STATUS_LABEL: Record<PermitStatus, string> = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  none: "No permit",
};

/** `yyyy-mm-dd` for today in Dubai, where the permits are issued. */
export function todayInDubai(): string {
  // en-CA renders as yyyy-mm-dd, matching the `date` columns.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
