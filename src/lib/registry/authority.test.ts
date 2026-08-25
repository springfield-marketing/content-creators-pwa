import { describe, expect, it } from "vitest";
import {
  EMIRATES,
  authorityFor,
  authorityLabelFor,
  isEmirate,
} from "./authority";

describe("authorityFor", () => {
  it("routes the two emirates that issue advertising permits", () => {
    expect(authorityFor("Dubai")).toBe("trakheesi");
    expect(authorityFor("Abu Dhabi")).toBe("madhmoun");
  });

  it("returns null for the five that issue none", () => {
    // Not a gap: Sharjah, Ajman, RAK, Fujairah and UAQ regulate developers
    // rather than adverts, so there is no permit and no QR to carry.
    for (const e of ["Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"]) {
      expect(authorityFor(e)).toBeNull();
    }
  });

  it("does not guess at an emirate it does not know", () => {
    expect(authorityFor("Dubayy")).toBeNull();
    expect(authorityFor("")).toBeNull();
    expect(authorityFor(null)).toBeNull();
    expect(authorityFor(undefined)).toBeNull();
  });

  it("is case- and spelling-exact, because the CHECK constraint is", () => {
    // The column is constrained to these exact strings, so anything else is a
    // write that should never have landed rather than a value to normalise.
    expect(authorityFor("dubai")).toBeNull();
    expect(authorityFor("ABU DHABI")).toBeNull();
  });
});

describe("isEmirate", () => {
  it("accepts all seven and nothing else", () => {
    for (const e of EMIRATES) expect(isEmirate(e)).toBe(true);
    expect(EMIRATES).toHaveLength(7);
    expect(isEmirate("Doha")).toBe(false);
    expect(isEmirate(null)).toBe(false);
  });
});

describe("authorityLabelFor", () => {
  it("names the authority where there is one", () => {
    expect(authorityLabelFor("Dubai")).toBe("Trakheesi");
    expect(authorityLabelFor("Abu Dhabi")).toBe("Madhmoun");
  });

  it("distinguishes 'no authority' from 'not an emirate'", () => {
    // A Sharjah permit is a real row with nothing to verify against; an
    // unrecognised emirate is a data problem. They should not read alike.
    expect(authorityLabelFor("Sharjah")).toBe("No permit authority");
    expect(authorityLabelFor("Dubayy")).toBe("Unknown emirate");
  });

  it("never says Madmoun, which is Dubai's QR service, not an authority", () => {
    for (const e of EMIRATES) expect(authorityLabelFor(e)).not.toBe("Madmoun");
  });
});
