import { describe, expect, it } from "vitest";
import { parseListingDate } from "./dates";

describe("parseListingDate", () => {
  it("reads dd/mm/yy, expanding the two-digit year", () => {
    expect(parseListingDate("15/10/25")).toBe("2025-10-15");
    expect(parseListingDate("15/10/26")).toBe("2026-10-15");
  });

  it("reads dd/mm/yyyy", () => {
    expect(parseListingDate("18/05/2026")).toBe("2026-05-18");
    expect(parseListingDate("30/01/2026")).toBe("2026-01-30");
    expect(parseListingDate("30/04/2026")).toBe("2026-04-30");
  });

  it("reads d-Mon-yyyy", () => {
    expect(parseListingDate("9-Apr-2025")).toBe("2025-04-09");
    expect(parseListingDate("1-Oct-2026")).toBe("2026-10-01");
    expect(parseListingDate("17-Aug-2026")).toBe("2026-08-17");
    expect(parseListingDate("4-Sep-2026")).toBe("2026-09-04");
  });

  it("is day-first, never month-first", () => {
    // 06/08/2026 is 6 August, not 8 June. Every date in the source sheet is
    // day-first; 15/10, 30/01 and 30/04 can only parse that way.
    expect(parseListingDate("06/08/2026")).toBe("2026-08-06");
  });

  it("returns null for blanks and unparseable values", () => {
    expect(parseListingDate("")).toBeNull();
    expect(parseListingDate("   ")).toBeNull();
    expect(parseListingDate("TBC")).toBeNull();
  });

  it("rejects impossible calendar dates rather than rolling them over", () => {
    expect(parseListingDate("32/01/2026")).toBeNull();
    expect(parseListingDate("15/13/2026")).toBeNull();
    expect(parseListingDate("31/02/2026")).toBeNull();
  });
});
