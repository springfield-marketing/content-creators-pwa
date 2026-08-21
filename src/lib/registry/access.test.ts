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

  describe("the content-ops axis grants nothing here", () => {
    // The whole reason permit roles are separate values rather than inferred:
    // three people manage the content team without being registry admins, and
    // deriving permit rights from rank would have silently promoted them.
    it("gives a plain manager no permit rights at all", () => {
      for (const capability of [
        "viewPermitDetails",
        "viewQr",
        "requestPermit",
        "issuePermit",
        "viewAllRequests",
        "viewOwnRequests",
        "batchRenew",
      ] as const) {
        expect(can(["manager"], capability)).toBe(false);
      }
    });

    it("gives team leads and executives nothing either", () => {
      expect(can(["team_lead"], "viewQr")).toBe(false);
      expect(can(["executive"], "viewPermitDetails")).toBe(false);
    });
  });

  describe("held together, roles add up", () => {
    it("gives a manager who is also a permit admin the admin powers", () => {
      expect(can(["manager", "permit_admin"], "issuePermit")).toBe(true);
    });

    it("gives a manager who is only an agent the agent's limits", () => {
      // Eloisa and Nihaal, exactly: managers here, agents against the registry.
      expect(can(["manager", "agent"], "requestPermit")).toBe(true);
      expect(can(["manager", "agent"], "viewPermitDetails")).toBe(false);
      expect(can(["manager", "agent"], "issuePermit")).toBe(false);
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

  it("turns away the content-ops roles that have no permit business", () => {
    expect(canReachRegistry(["manager"])).toBe(false);
    expect(canReachRegistry(["executive"])).toBe(false);
    expect(canReachRegistry(["team_lead"])).toBe(false);
  });
});
