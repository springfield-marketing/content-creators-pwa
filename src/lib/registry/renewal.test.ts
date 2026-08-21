import { describe, expect, it } from "vitest";
import { RENEWAL_HEADERS, parseRenewals } from "./renewal";

const head = [...RENEWAL_HEADERS];
const row = (
  id: string,
  permit: string,
  start = "15/10/2026",
  end = "14/10/2027",
) => [id, "3310", "Some Project", "0011621057", permit, start, end];

describe("parseRenewals", () => {
  it("reads a filled row", () => {
    const r = parseRenewals([head, row("12", "0987654321")]);
    expect(r.rows).toEqual([
      {
        projectId: 12,
        permitNumber: "0987654321",
        listingStart: "2026-10-15",
        listingEnd: "2027-10-14",
      },
    ]);
    expect(r.errors).toEqual([]);
  });

  it("skips rows with no new permit number instead of erroring", () => {
    // The template ships every project; admins fill only the ones renewing.
    const r = parseRenewals([head, row("12", ""), row("13", "0987654321")]);
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([]);
  });

  it("accepts the date formats the source sheet already uses", () => {
    const r = parseRenewals([
      head,
      row("12", "0987654321", "15/10/26", "15-Oct-2027"),
    ]);
    expect(r.rows[0].listingStart).toBe("2026-10-15");
    expect(r.rows[0].listingEnd).toBe("2027-10-15");
  });

  it("keeps leading zeros on the new permit number", () => {
    const r = parseRenewals([head, row("12", "0004141989")]);
    expect(r.rows[0].permitNumber).toBe("0004141989");
  });

  it("reports a bad permit number against its line", () => {
    const r = parseRenewals([head, row("12", "ABC")]);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([
      { line: 2, message: "The permit number should be 6–15 digits." },
    ]);
  });

  it("reports an unreadable date", () => {
    const r = parseRenewals([head, row("12", "0987654321", "soon")]);
    expect(r.errors[0].message).toMatch(/start date/i);
  });

  it("reports an end date before the start", () => {
    const r = parseRenewals([
      head,
      row("12", "0987654321", "15/10/2027", "15/10/2026"),
    ]);
    expect(r.errors[0].message).toMatch(/cannot be before/i);
  });

  it("rejects a missing or non-numeric project id", () => {
    expect(parseRenewals([head, row("", "0987654321")]).errors).toHaveLength(1);
    expect(parseRenewals([head, row("x", "0987654321")]).errors).toHaveLength(1);
  });

  it("rejects a file whose headers do not match the template", () => {
    const r = parseRenewals([["nope", "wrong"], ["1", "2"]]);
    expect(r.errors[0].message).toMatch(/template/i);
    expect(r.rows).toEqual([]);
  });

  it("rejects the same project appearing twice", () => {
    // Two renewals for one project in one upload is a copy-paste slip, and
    // applying both would leave whichever ran last silently winning.
    const r = parseRenewals([head, row("12", "0987654321"), row("12", "0123456789")]);
    expect(r.errors[0].message).toMatch(/twice/i);
    expect(r.rows).toEqual([]);
  });

  it("ignores trailing blank lines", () => {
    const r = parseRenewals([head, row("12", "0987654321"), [], ["", "", ""]]);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });
});
