import { describe, expect, it } from "vitest";
import { ROUTE_ROLES, allowed } from "./route-access";
import { can } from "./registry/access";
import { homeFor } from "./roles";
import type { Role } from "@/auth";

describe("allowed", () => {
  describe("agents, who now provision themselves on sign-in", () => {
    // The population that grew from 0 sessions to ~150 overnight. Everything
    // here is a door that must stay shut.
    const agent: Role[] = ["agent"];

    it("reaches the registry and nothing else", () => {
      expect(allowed("/permits", agent)).toBe(true);
      expect(allowed("/permits/requests", agent)).toBe(true);
      expect(allowed("/api/permits/projects", agent)).toBe(true);
    });

    it("is kept out of every admin screen", () => {
      expect(allowed("/admin", agent)).toBe(false);
      expect(allowed("/admin/review", agent)).toBe(false);
      expect(allowed("/admin/kpis", agent)).toBe(false);
      expect(allowed("/admin/agents", agent)).toBe(false);
      expect(allowed("/admin/team", agent)).toBe(false);
    });

    it("is kept out of the admin and creator APIs", () => {
      expect(allowed("/api/admin/deliverables", agent)).toBe(false);
      expect(allowed("/api/admin/review-queue", agent)).toBe(false);
      expect(allowed("/api/admin/kpis", agent)).toBe(false);
      expect(allowed("/api/me/bookings", agent)).toBe(false);
    });

    it("is kept out of creator screens and reports", () => {
      expect(allowed("/creator", agent)).toBe(false);
      expect(allowed("/creator/log", agent)).toBe(false);
      expect(allowed("/reports", agent)).toBe(false);
      expect(allowed("/api/reports/kpis", agent)).toBe(false);
    });
  });

  describe("creators", () => {
    const creator: Role[] = ["creator"];

    it("read permits through the API, from inside their own shell", () => {
      expect(allowed("/api/permits/projects", creator)).toBe(true);
      expect(allowed("/creator/permits", creator)).toBe(true);
    });

    it("do not get the standalone registry screen", () => {
      // Nothing is leaked by it, but their shell is the mobile one.
      expect(allowed("/permits", creator)).toBe(false);
    });

    it("still cannot reach admin or reports", () => {
      expect(allowed("/admin/review", creator)).toBe(false);
      expect(allowed("/reports", creator)).toBe(false);
    });
  });

  describe("the existing gates still hold", () => {
    it("keeps team leads on the review screen alone", () => {
      expect(allowed("/admin/review", ["team_lead"])).toBe(true);
      expect(allowed("/api/admin/review-queue", ["team_lead"])).toBe(true);
      expect(allowed("/api/admin/deliverables", ["team_lead"])).toBe(true);
      expect(allowed("/admin/kpis", ["team_lead"])).toBe(false);
      expect(allowed("/admin/team", ["team_lead"])).toBe(false);
    });

    it("lets managers everywhere they went before", () => {
      expect(allowed("/admin", ["manager"])).toBe(true);
      expect(allowed("/admin/review", ["manager"])).toBe(true);
      expect(allowed("/reports", ["manager"])).toBe(true);
    });

    it("keeps executives to reports", () => {
      expect(allowed("/reports", ["executive"])).toBe(true);
      expect(allowed("/api/reports/kpis", ["executive"])).toBe(true);
      expect(allowed("/admin", ["executive"])).toBe(false);
    });

    it("does not let a registry role open a content-ops door", () => {
      // The two axes stay separate at the route layer too.
      expect(allowed("/admin", ["permit_admin"])).toBe(false);
      expect(allowed("/admin/review", ["marketing"])).toBe(false);
      expect(allowed("/creator", ["permit_admin"])).toBe(false);
    });
  });

  describe("the permits list holds both kinds of permit", () => {
    it("lets a manager in, because they own the general codes", () => {
      expect(allowed("/permits", ["manager"])).toBe(true);
    });

    it("still grants a manager nothing in the registry itself", () => {
      // Reaching the list is not the same as reading offplan permits — that is
      // decided by the capability table, which gives manager nothing. The page
      // redacts accordingly.
      expect(can(["manager"], "viewPermitDetails")).toBe(false);
      expect(can(["manager"], "issuePermit")).toBe(false);
    });

    it("keeps agents away from managing general codes", () => {
      // The list admits them; the write API stays under /api/admin, which the
      // route table does not open to agents.
      expect(allowed("/api/admin/permits", ["agent"])).toBe(false);
      expect(allowed("/api/admin/permits", ["marketing"])).toBe(false);
    });

    it("does not let a team lead or executive in", () => {
      expect(allowed("/permits", ["team_lead"])).toBe(false);
      expect(allowed("/permits", ["executive"])).toBe(false);
    });
  });

  describe("failing shut", () => {
    it("denies a matched path with no rule", () => {
      // A new screen under a matched prefix with no entry here should lock,
      // not open. Nothing currently reaches this, which is the point.
      expect(allowed("/somewhere-ungated", ["manager"])).toBe(false);
    });

    it("denies everything to a user with no roles", () => {
      for (const [prefix] of ROUTE_ROLES) {
        expect(allowed(prefix, [])).toBe(false);
      }
    });
  });
});

describe("homeFor lands every role somewhere real", () => {
  // A role with no home returns "/login", which for an already-signed-in user
  // is a redirect loop: / -> /login -> /. Agents hit this before the registry
  // roles were added.
  const ALL: Role[] = [
    "creator",
    "team_lead",
    "manager",
    "executive",
    "agent",
    "marketing",
    "permit_admin",
  ];

  for (const role of ALL) {
    it(`sends ${role} somewhere they are allowed`, () => {
      const home = homeFor([role]);
      expect(home).not.toBe("/login");
      expect(allowed(home, [role])).toBe(true);
    });
  }

  it("sends a manager who is only an agent to the review screen", () => {
    // Eloisa and Nihaal: the content-ops job comes first.
    expect(homeFor(["manager", "agent"])).toBe("/admin/review");
  });

  it("still sends a plain manager to the review screen, not to permits", () => {
    // /permits admits managers for the General tab, but it is not their home.
    expect(homeFor(["manager"])).toBe("/admin/review");
  });
});
