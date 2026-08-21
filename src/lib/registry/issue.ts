export type IssueInput = {
  permitNumber: string;
  listingStart: string;
  listingEnd: string;
};

export type IssueResult =
  | { ok: true; value: IssueInput }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function validateIssue(input: IssueInput): IssueResult {
  const permitNumber = input.permitNumber.trim();
  const listingStart = input.listingStart.trim();
  const listingEnd = input.listingEnd.trim();

  if (!permitNumber) return { ok: false, error: "Enter the permit number." };
  // Kept as a string so leading zeros survive; digits only, since anything
  // else is a typo or a pasted label rather than a Trakheesi number.
  if (!/^\d{6,15}$/.test(permitNumber))
    return { ok: false, error: "The permit number should be 6–15 digits." };

  if (!isRealIsoDate(listingStart))
    return { ok: false, error: "Enter a valid start date." };
  if (!isRealIsoDate(listingEnd))
    return { ok: false, error: "Enter a valid end date." };
  if (listingEnd < listingStart)
    return { ok: false, error: "The end date cannot be before the start date." };

  return { ok: true, value: { permitNumber, listingStart, listingEnd } };
}

/**
 * Permits run a year, so the window ends the day before the anniversary.
 *
 * A 29 Feb start needs no special case: Date.UTC rolls the non-existent
 * anniversary to 1 March, and subtracting the day lands on 28 Feb.
 */
export function defaultListingEnd(start: string): string {
  if (!isRealIsoDate(start)) return "";
  const [y, m, d] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y + 1, m - 1, d - 1));
  return end.toISOString().slice(0, 10);
}

export type NewProjectInput = {
  name: string;
  dldProjectNumber: string;
  developer: string;
  emirate: string;
};

export type NewProjectResult =
  | { ok: true; value: { name: string; dldProjectNumber: string | null; developer: string | null; emirate: string | null } }
  | { ok: false; error: string };

/**
 * Fields for a project being created from a marketing request, where the
 * project is not tracked yet.
 *
 * The DLD number is optional: developer-level permits genuinely have none, and
 * a project can be recorded before its number is known.
 */
export function validateNewProject(input: NewProjectInput): NewProjectResult {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter the project name." };
  if (name.length > 200)
    return { ok: false, error: "That project name is too long." };

  const dld = input.dldProjectNumber.trim();
  if (dld && !/^\d{1,10}$/.test(dld))
    return { ok: false, error: "The DLD project number should be digits only." };

  return {
    ok: true,
    value: {
      name,
      dldProjectNumber: dld || null,
      developer: input.developer.trim().replace(/\s+/g, " ") || null,
      emirate: input.emirate.trim() || null,
    },
  };
}
