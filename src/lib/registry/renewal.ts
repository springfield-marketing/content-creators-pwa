import { validateIssue } from "./issue";
import { parseListingDate } from "./dates";

export const RENEWAL_HEADERS = [
  "project_id",
  "dld_project_number",
  "project_name",
  "current_permit",
  "new_permit_number",
  "listing_start",
  "listing_end",
] as const;

export type RenewalRow = {
  projectId: number;
  permitNumber: string;
  listingStart: string;
  listingEnd: string;
};

export type RenewalParse = {
  rows: RenewalRow[];
  errors: Array<{ line: number; message: string }>;
  skipped: number;
};

const COL = {
  projectId: 0,
  newPermit: 4,
  start: 5,
  end: 6,
};

/**
 * Reads the filled-in renewal template.
 *
 * Every project ships in the template, so a blank permit number means "not
 * renewing this one" rather than an error. Anything genuinely wrong is
 * reported against its line and the whole upload is refused — a partial apply
 * across 396 rows would be worse than starting over.
 */
export function parseRenewals(records: string[][]): RenewalParse {
  const errors: RenewalParse["errors"] = [];
  const rows: RenewalRow[] = [];
  let skipped = 0;

  const header = (records[0] ?? []).map((h) => h.trim().toLowerCase());
  const headerOk = RENEWAL_HEADERS.every((h, i) => header[i] === h);
  if (!headerOk) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            "This file does not match the renewal template. Download a fresh copy and fill that in.",
        },
      ],
      skipped: 0,
    };
  }

  const seen = new Map<number, number>();

  records.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (!r.length || r.every((c) => !c.trim())) return;

    const permitNumber = (r[COL.newPermit] ?? "").trim();
    if (!permitNumber) {
      skipped++;
      return;
    }

    const rawId = (r[COL.projectId] ?? "").trim();
    const projectId = Number(rawId);
    if (!rawId || !Number.isInteger(projectId) || projectId <= 0) {
      errors.push({ line, message: "Missing or invalid project_id." });
      return;
    }

    const first = seen.get(projectId);
    if (first !== undefined) {
      errors.push({
        line,
        message: `Project appears twice — also on line ${first}.`,
      });
      return;
    }
    seen.set(projectId, line);

    const listingStart = parseListingDate(r[COL.start] ?? "");
    const listingEnd = parseListingDate(r[COL.end] ?? "");
    if (!listingStart) {
      errors.push({ line, message: "Could not read the start date." });
      return;
    }
    if (!listingEnd) {
      errors.push({ line, message: "Could not read the end date." });
      return;
    }

    const checked = validateIssue({ permitNumber, listingStart, listingEnd });
    if (!checked.ok) {
      errors.push({ line, message: checked.error });
      return;
    }

    rows.push({ projectId, ...checked.value });
  });

  return errors.length ? { rows: [], errors, skipped } : { rows, errors, skipped };
}
