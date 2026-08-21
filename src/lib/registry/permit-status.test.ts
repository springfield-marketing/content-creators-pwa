import { describe, expect, it } from "vitest";
import { EXPIRING_WINDOW_DAYS, daysUntil, permitStatus } from "./permit-status";

const TODAY = "2026-08-06";

describe("permitStatus", () => {
  it("is active when the window ends well ahead", () => {
    expect(permitStatus("2026-10-15", TODAY)).toBe("active");
  });

  it("is expiring inside the warning window", () => {
    expect(permitStatus("2026-09-01", TODAY)).toBe("expiring");
  });

  it("counts the last day of the window as still valid", () => {
    // A permit is good through its end date, not up to it.
    expect(permitStatus(TODAY, TODAY)).toBe("expiring");
  });

  it("is expired the day after the window ends", () => {
    expect(permitStatus("2026-08-05", TODAY)).toBe("expired");
  });

  it("treats the warning boundary as inclusive", () => {
    const edge = "2026-09-05"; // exactly 30 days out
    expect(daysUntil(edge, TODAY)).toBe(EXPIRING_WINDOW_DAYS);
    expect(permitStatus(edge, TODAY)).toBe("expiring");
    expect(permitStatus("2026-09-06", TODAY)).toBe("active");
  });

  it("is none when the project has no permit at all", () => {
    expect(permitStatus(null, TODAY)).toBe("none");
  });
});

describe("daysUntil", () => {
  it("counts whole calendar days", () => {
    expect(daysUntil("2026-08-07", TODAY)).toBe(1);
    expect(daysUntil("2026-08-06", TODAY)).toBe(0);
    expect(daysUntil("2026-08-05", TODAY)).toBe(-1);
  });

  it("is unaffected by daylight saving shifts", () => {
    // Parsed as UTC, so a DST transition inside the range cannot round to 89.5
    // days and truncate to 89.
    expect(daysUntil("2027-08-06", TODAY)).toBe(365);
  });
});
