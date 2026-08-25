/**
 * Which authority issues a permit, worked out from the emirate it covers.
 *
 * Dubai advertising permits come from **Trakheesi** (DLD/RERA), and the QR that
 * has to appear on adverts is DLD's "Madmoun" service inside it. Abu Dhabi
 * permits come from **Madhmoun** (ADREC, on the DARI platform), mandatory since
 * July 2025.
 *
 * Note the single `h`. "Madmoun" is Dubai's QR service and "Madhmoun" is Abu
 * Dhabi's permit system — near-identical names for different things, and the
 * public write-ups routinely conflate them. Only `madhmoun` is a value here; if
 * `madmoun` ever appears as one, it is a typo rather than a second authority.
 *
 * The other five emirates regulate developers rather than adverts — RAK through
 * RERA-RAK, the rest municipally — so they issue no advertising permit and
 * `authorityFor` returns null. That is a real answer, not a missing case.
 *
 * Derived rather than stored: the emirate is on the permit row, and holding the
 * authority beside it would only give the two something to disagree about.
 */

export const EMIRATES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Ras Al Khaimah",
  "Fujairah",
  "Umm Al Quwain",
] as const;

export type Emirate = (typeof EMIRATES)[number];

export type Authority = "trakheesi" | "madhmoun";

export const AUTHORITY_LABEL: Record<Authority, string> = {
  trakheesi: "Trakheesi",
  madhmoun: "Madhmoun",
};

const BY_EMIRATE: Partial<Record<Emirate, Authority>> = {
  Dubai: "trakheesi",
  "Abu Dhabi": "madhmoun",
};

export function isEmirate(value: string | null | undefined): value is Emirate {
  return !!value && (EMIRATES as readonly string[]).includes(value);
}

/** Null where the emirate runs no advertising-permit scheme. */
export function authorityFor(emirate: string | null | undefined): Authority | null {
  return isEmirate(emirate) ? (BY_EMIRATE[emirate] ?? null) : null;
}

/** What to show in a column: the authority's name, or why there isn't one. */
export function authorityLabelFor(emirate: string | null | undefined): string {
  const authority = authorityFor(emirate);
  if (authority) return AUTHORITY_LABEL[authority];
  return isEmirate(emirate) ? "No permit authority" : "Unknown emirate";
}
