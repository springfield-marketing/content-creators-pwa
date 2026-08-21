import { describe, expect, it } from "vitest";
import { can, canReachRegistry } from "./access";

describe("can", () => {
  it("lets permit admins do everything the registry offers", () => {
    expect(can(["permit_admin"], "viewQr")).toBe(true);
    expect(can(["permit_admin"], "issuePermit")).toBe(true);
    expect(can(["permit_admin"], "viewAllRequests")).toBe(true);
    expect(can(["permit_admin"], "batchRenew")).toBe(true);
  });

  it("lets marketing download and request but not issue", () => {
    expect(can(["marketing"], "viewQr")).toBe(true);
    expect(can(["marketing"], "requestPermit")).toBe(true);
    expect(can(["marketing"], "issuePermit")).toBe(false);
    expect(can(["marketing"], "viewAllRequests")).toBe(false);
    expect(can(["marketing"], "viewOwnRequests")).toBe(true);
  });

  it("limits agents to whether a permit exists", () => {
    expect(can(["agent"], "viewPermitDetails")).toBe(false);
    expect(can(["agent"], "viewQr")).toBe(false);
    expect(can(["agent"], "issuePermit")).toBe(false);
  });

  it("lets agents raise requests and follow their own", () => {
    // Their whole workflow: a project is not listed, so ask for a permit.
    expect(can(["agent"], "requestPermit")).toBe(true);
    expect(can(["agent"], "viewOwnRequests")).toBe(true);
    expect(can(["agent"], "viewAllRequests")).toBe(false);
  });

  describe("creators", () => {
    it("read the permit number and QR for what they are shooting", () => {
      // The reason the registry was merged in: creators type permit numbers
      // into deliverables by hand and had nowhere to look them up.
      expect(can(["creator"], "viewPermitDetails")).toBe(true);
      expect(can(["creator"], "viewQr")).toBe(true);
    });

    it("never request or issue", () => {
      expect(can(["creator"], "requestPermit")).toBe(false);
      expect(can(["creator"], "issuePermit")).toBe(false);
      expect(can(["creator"], "viewOwnRequests")).toBe(false);
      expect(can(["creator"], "batchRenew")).toBe(false);
    });
  });

  describe("managers run the permits tab in the dashboard", () => {
    // The tab exists for admins to view, edit, renew and add. Offering a
    // manager the Renewals link and then bouncing them off it was the
    // alternative, and that is what it used to do.
    it("lets a manager do everything the dashboard offers", () => {
      for (const capability of [
        "viewPermitDetails",
        "viewQr",
        "issuePermit",
        "viewAllRequests",
        "viewOwnRequests",
        "batchRenew",
      ] as const) {
        expect(can(["manager"], capability)).toBe(true);
      }
    });

    it("does not have them requesting permits from themselves", () => {
      expect(can(["manager"], "requestPermit")).toBe(false);
    });

    it("still gives team leads and executives nothing", () => {
      // The widening is to `manager` alone, not to content-ops generally.
      expect(can(["team_lead"], "viewQr")).toBe(false);
      expect(can(["team_lead"], "issuePermit")).toBe(false);
      expect(can(["executive"], "viewPermitDetails")).toBe(false);
      expect(can(["executive"], "batchRenew")).toBe(false);
    });
  });

  describe("held together, roles add up", () => {
    it("gives a manager who is also a permit admin the admin powers", () => {
      expect(can(["manager", "permit_admin"], "issuePermit")).toBe(true);
    });

    it("gives a manager who is also an agent both sets", () => {
      // Eloisa and Nihaal: managers here, agents against the old registry.
      // Roles add up, so the manager half now carries the dashboard rights.
      expect(can(["manager", "agent"], "requestPermit")).toBe(true);
      expect(can(["manager", "agent"], "viewPermitDetails")).toBe(true);
      expect(can(["manager", "agent"], "issuePermit")).toBe(true);
    });

    it("still lets marketing in without any content-ops access", () => {
      // The reason permit roles remain separate values: marketing maintains
      // permits and reaches nothing else in the dashboard.
      expect(can(["marketing"], "viewPermitDetails")).toBe(true);
      expect(can(["marketing"], "issuePermit")).toBe(false);
    });

    it("lets a creator who leads a team still read permits", () => {
      expect(can(["creator", "team_lead"], "viewQr")).toBe(true);
    });
  });
});

describe("canReachRegistry", () => {
  it("admits everyone with a reason to be there", () => {
    expect(canReachRegistry(["permit_admin"])).toBe(true);
    expect(canReachRegistry(["marketing"])).toBe(true);
    expect(canReachRegistry(["agent"])).toBe(true);
    expect(canReachRegistry(["creator"])).toBe(true);
  });

  it("admits managers, who run the permits tab", () => {
    expect(canReachRegistry(["manager"])).toBe(true);
  });

  it("turns away the content-ops roles that have no permit business", () => {
    expect(canReachRegistry(["executive"])).toBe(false);
    expect(canReachRegistry(["team_lead"])).toBe(false);
  });
});
