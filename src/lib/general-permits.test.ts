import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { digitsOnly, hidesGeneralPermits, notGeneralPermit } from "./general-permits";

describe("digitsOnly", () => {
  it("reduces the ways a permit actually arrives to the same code", () => {
    // All of these appear verbatim in logged deliverables.
    expect(digitsOnly("0275066700")).toBe("0275066700");
    expect(digitsOnly("PERMIT NUMBER 0275066700")).toBe("0275066700");
    expect(digitsOnly("General QR code 2113748196")).toBe("2113748196");
    expect(digitsOnly("General HR Video permit : 0977435990")).toBe("0977435990");
  });

  it("keeps leading zeros, which are part of the number", () => {
    expect(digitsOnly("0977435990")).toBe("0977435990");
  });

  it("yields nothing for permits that are not numbers", () => {
    // These must never match a code, which is why general permit numbers are
    // CHECK-constrained to digits — there is no blank code to collide with.
    expect(digitsOnly("N/A")).toBe("");
    expect(digitsOnly("No permit - Omar Essam")).toBe("");
    expect(digitsOnly("")).toBe("");
  });
});

describe("hidesGeneralPermits", () => {
  it("hides them from a team lead", () => {
    expect(hidesGeneralPermits(["team_lead"])).toBe(true);
    expect(hidesGeneralPermits(["creator", "team_lead"])).toBe(true);
  });

  it("shows them to a manager, including one who also leads a team", () => {
    expect(hidesGeneralPermits(["manager"])).toBe(false);
    expect(hidesGeneralPermits(["team_lead", "manager"])).toBe(false);
  });

  it("is irrelevant to anyone who cannot review", () => {
    expect(hidesGeneralPermits(["creator"])).toBe(false);
    expect(hidesGeneralPermits(["agent"])).toBe(false);
  });
});

describe("notGeneralPermit", () => {
  // Compiled through drizzle's own dialect rather than by poking at the SQL
  // object's internals, so this asserts what Postgres would actually receive.
  const compiled = new PgDialect().sqlToQuery(notGeneralPermit()).sql;

  // The predicate runs against `permits`, which now also holds the offplan
  // registry. 32 offplan permit numbers appear on real deliverables, so
  // dropping the category pin would silently hide those from team leads too —
  // a change to who reviews real work, with nothing to notice it by.
  it("pins the category, so offplan permits cannot route review", () => {
    expect(compiled).toContain("category");
    expect(compiled).toContain("general");
  });

  it("only counts codes that are switched on", () => {
    // An expired general code keeps routing to managers until someone turns it
    // off; a date passing must never reassign review work on its own.
    expect(compiled).toContain("is_active");
  });

  it("matches on digits, so a free-text permit still resolves", () => {
    expect(compiled).toContain("regexp_replace");
  });
});
