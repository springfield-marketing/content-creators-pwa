import { describe, expect, it } from "vitest";
import { defaultListingEnd, validateIssue, validateNewProject } from "./issue";

const valid = {
  permitNumber: "0487839955",
  listingStart: "2026-10-15",
  listingEnd: "2027-10-15",
};

describe("validateIssue", () => {
  it("accepts a well-formed permit", () => {
    expect(validateIssue(valid)).toEqual({ ok: true, value: valid });
  });

  it("keeps leading zeros on the permit number", () => {
    const r = validateIssue({ ...valid, permitNumber: " 0004141989 " });
    expect(r.ok && r.value.permitNumber).toBe("0004141989");
  });

  it("rejects a missing permit number", () => {
    const r = validateIssue({ ...valid, permitNumber: "  " });
    expect(r).toEqual({ ok: false, error: "Enter the permit number." });
  });

  it("rejects a permit number that is not digits", () => {
    // Trakheesi numbers are all digits; letters mean a typo or a pasted label.
    expect(validateIssue({ ...valid, permitNumber: "ABC123456" }).ok).toBe(false);
    expect(validateIssue({ ...valid, permitNumber: "048-783-9955" }).ok).toBe(false);
  });

  it("rejects an implausibly short or long permit number", () => {
    expect(validateIssue({ ...valid, permitNumber: "123" }).ok).toBe(false);
    expect(validateIssue({ ...valid, permitNumber: "1".repeat(20) }).ok).toBe(false);
  });

  it("rejects missing or malformed dates", () => {
    expect(validateIssue({ ...valid, listingStart: "" }).ok).toBe(false);
    expect(validateIssue({ ...valid, listingStart: "15/10/2026" }).ok).toBe(false);
    expect(validateIssue({ ...valid, listingEnd: "2026-13-01" }).ok).toBe(false);
  });

  it("rejects an end date before the start", () => {
    const r = validateIssue({
      ...valid,
      listingStart: "2027-10-15",
      listingEnd: "2026-10-15",
    });
    expect(r).toEqual({
      ok: false,
      error: "The end date cannot be before the start date.",
    });
  });

  it("allows a single-day window", () => {
    // The one-day OPEN HOUSE event permit under #3385 is a real shape.
    expect(
      validateIssue({
        ...valid,
        listingStart: "2026-10-01",
        listingEnd: "2026-10-01",
      }).ok,
    ).toBe(true);
  });
});

describe("defaultListingEnd", () => {
  it("is one year on, minus a day", () => {
    // A permit issued on 15 Oct 2026 runs through 14 Oct 2027.
    expect(defaultListingEnd("2026-10-15")).toBe("2027-10-14");
  });

  it("handles a leap day without rolling into March", () => {
    expect(defaultListingEnd("2028-02-29")).toBe("2029-02-28");
  });

  it("returns empty for an unusable start", () => {
    expect(defaultListingEnd("")).toBe("");
  });
});

describe("validateNewProject", () => {
  const base = {
    name: "Marina Heights",
    dldProjectNumber: "4131",
    developer: "AMIS SIGNATURE",
    emirate: "Dubai",
  };

  it("accepts a complete project", () => {
    const r = validateNewProject(base);
    expect(r.ok && r.value).toEqual({
      name: "Marina Heights",
      dldProjectNumber: "4131",
      developer: "AMIS SIGNATURE",
      emirate: "Dubai",
    });
  });

  it("collapses stray whitespace in names", () => {
    const r = validateNewProject({ ...base, name: "  Marina   Heights " });
    expect(r.ok && r.value.name).toBe("Marina Heights");
  });

  it("requires a name", () => {
    expect(validateNewProject({ ...base, name: "   " }).ok).toBe(false);
  });

  it("allows a project with no DLD number yet", () => {
    // Developer-level permits genuinely have none, and a project can be
    // recorded before DLD issues its number.
    const r = validateNewProject({ ...base, dldProjectNumber: "" });
    expect(r.ok && r.value.dldProjectNumber).toBeNull();
  });

  it("rejects a non-numeric DLD number", () => {
    expect(validateNewProject({ ...base, dldProjectNumber: "P-4131" }).ok).toBe(false);
  });

  it("treats blank developer and emirate as absent", () => {
    const r = validateNewProject({ ...base, developer: " ", emirate: "" });
    expect(r.ok && r.value.developer).toBeNull();
    expect(r.ok && r.value.emirate).toBeNull();
  });
});
