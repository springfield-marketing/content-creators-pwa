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

  describe("permits are maintained in the dashboard", () => {
    it("admits the people who maintain them", () => {
      for (const role of ["manager", "permit_admin", "marketing"] as const) {
        expect(allowed("/admin/permits", [role])).toBe(true);
        expect(allowed("/admin/permits/renew", [role])).toBe(true);
        expect(allowed("/api/admin/permits", [role])).toBe(true);
      }
    });

    it("lets marketing in for permits WITHOUT opening the rest of admin", () => {
      // The whole reason /admin/permits sits above /admin in the table.
      expect(allowed("/admin/permits", ["marketing"])).toBe(true);
      expect(allowed("/admin", ["marketing"])).toBe(false);
      expect(allowed("/admin/review", ["marketing"])).toBe(false);
      expect(allowed("/admin/kpis", ["marketing"])).toBe(false);
      expect(allowed("/admin/team", ["marketing"])).toBe(false);
    });

    it("keeps agents out of the dashboard entirely", () => {
      expect(allowed("/admin/permits", ["agent"])).toBe(false);
      expect(allowed("/api/admin/permits", ["agent"])).toBe(false);
      expect(allowed("/admin", ["agent"])).toBe(false);
    });

    it("gives managers the capabilities the screen offers", () => {
      // The sidebar shows a manager every permits link, so the capability
      // table has to back all of them — offering a link that bounces is worse
      // than not offering it.
      expect(can(["manager"], "viewPermitDetails")).toBe(true);
      expect(can(["manager"], "issuePermit")).toBe(true);
      expect(can(["manager"], "batchRenew")).toBe(true);
    });
  });

  describe("the agent-facing view", () => {
    it("admits agents", () => {
      expect(allowed("/permits", ["agent"])).toBe(true);
      expect(allowed("/permits/requests", ["agent"])).toBe(true);
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
