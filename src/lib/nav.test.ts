import { describe, expect, it } from "vitest";
import { activeNavHref } from "./nav";

// The real sidebar, so the test breaks if the nav gains a nesting the rule
// cannot handle.
const SIDEBAR = [
  "/admin/review",
  "/admin/review-log",
  "/admin/permits",
  "/admin/permits/requests",
  "/admin/permits/renew",
  "/admin/schedule",
  "/admin/bookings",
  "/admin/activity",
  "/admin/kpis",
  "/admin/targets",
  "/admin/creators",
  "/admin/agents",
  "/admin/team",
];

describe("activeNavHref", () => {
  it("lights the child, not the parent, on a nested screen", () => {
    // The bug: "All permits" stayed lit while you were on Requests below it,
    // because /admin/permits/requests does start with /admin/permits.
    expect(activeNavHref("/admin/permits/requests", SIDEBAR)).toBe(
      "/admin/permits/requests",
    );
    expect(activeNavHref("/admin/permits/renew", SIDEBAR)).toBe(
      "/admin/permits/renew",
    );
  });

  it("lights the parent on the parent's own screen", () => {
    expect(activeNavHref("/admin/permits", SIDEBAR)).toBe("/admin/permits");
  });

  it("keeps a screen lit inside its own sub-paths", () => {
    // /admin/creators/<id> has no nav entry of its own, so Creators stays lit.
    expect(activeNavHref("/admin/creators/abc-123", SIDEBAR)).toBe(
      "/admin/creators",
    );
  });

  it("does not confuse sibling screens that share a prefix", () => {
    // Without the trailing slash, /admin/review would match /admin/review-log.
    expect(activeNavHref("/admin/review-log", SIDEBAR)).toBe(
      "/admin/review-log",
    );
    expect(activeNavHref("/admin/review", SIDEBAR)).toBe("/admin/review");
  });

  it("lights nothing on a path outside the nav", () => {
    expect(activeNavHref("/reports", SIDEBAR)).toBeUndefined();
    expect(activeNavHref("/", SIDEBAR)).toBeUndefined();
  });

  it("never lights more than one link", () => {
    for (const path of [
      "/admin/permits",
      "/admin/permits/requests",
      "/admin/permits/renew",
      "/admin/review",
      "/admin/review-log",
      "/admin/creators/abc-123",
    ]) {
      const active = activeNavHref(path, SIDEBAR);
      const lit = SIDEBAR.filter((h) => h === active);
      expect(lit).toHaveLength(1);
    }
  });
});
