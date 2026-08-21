// Date parsing for the renewal template, lifted from the registry's sheet
// importer. Only this one function came across: the rest of that module read
// column positions out of the original Google Sheet, which was imported once
// and will never be read again now the projects live here.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function iso(y: number, m: number, d: number): string | null {
  if (!isRealDate(y, m, d)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Parses the date formats the permit sheet uses into ISO `yyyy-mm-dd`.
 *
 * Slash dates are day-first. `15/10`, `30/01` and `30/04` can only be read that
 * way, so there is no month-first case to disambiguate against.
 */
export function parseListingDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return iso(year, Number(m), Number(d));
  }

  const dashed = s.match(/^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{4})$/);
  if (dashed) {
    const [, d, mon, y] = dashed;
    const m = MONTHS[mon.toLowerCase()];
    if (!m) return null;
    return iso(Number(y), m, Number(d));
  }

  return null;
}
