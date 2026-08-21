import { describe, expect, it } from "vitest";
import { forRoles } from "./visibility";
import type { ProjectRow } from "./queries";

const row: ProjectRow = {
  id: 1,
  dldProjectNumber: "4131",
  name: "Derby Heights",
  developer: "AMIS SIGNATURE",
  emirate: "Dubai",
  permitNumber: "0487839955",
  listingEnd: "2026-10-15",
  qrUrl: "https://blob.example.com/qr.png",
  status: "active",
  otherPermits: 1,
  fileCount: 4,
};

describe("forRoles", () => {
  it("gives admins everything untouched", () => {
    expect(forRoles([row], ["permit_admin"])[0]).toEqual(row);
  });

  it("gives marketing everything untouched", () => {
    expect(forRoles([row], ["marketing"])[0]).toEqual(row);
  });

  describe("agents", () => {
    const [seen] = forRoles([row], ["agent"]);

    it("keep the name and developer so search still works", () => {
      expect(seen.name).toBe("Derby Heights");
      expect(seen.developer).toBe("AMIS SIGNATURE");
    });

    it("never receive the QR url", () => {
      // Blob urls are public, so hiding the button is not a restriction —
      // the value must not reach the browser at all.
      expect(seen.qrUrl).toBeNull();
    });

    it("never receive the file list size either", () => {
      // A count is not sensitive on its own, but agents have no QR button, so
      // there is no reason to ship it.
      expect(seen.fileCount).toBe(0);
    });

    it("never receive permit details", () => {
      expect(seen.permitNumber).toBeNull();
      expect(seen.dldProjectNumber).toBeNull();
      expect(seen.listingEnd).toBeNull();
    });

    it("still learn whether a permit is usable", () => {
      expect(seen.status).toBe("active");
    });

    it("see expiring permits as still active", () => {
      // Agents get a usable/not-usable answer, not a countdown.
      const soon = forRoles([{ ...row, status: "expiring" }], ["agent"])[0];
      expect(soon.status).toBe("active");
    });

    it("see expired and missing permits alike as unavailable", () => {
      expect(forRoles([{ ...row, status: "expired" }], ["agent"])[0].status).toBe("none");
      expect(forRoles([{ ...row, status: "none" }], ["agent"])[0].status).toBe("none");
    });

    it("do not leak details through a serialised payload", () => {
      const json = JSON.stringify(forRoles([row], ["agent"]));
      expect(json).not.toContain("0487839955");
      expect(json).not.toContain("blob.example.com");
      expect(json).not.toContain("4131");
    });
  });
});

describe("creators", () => {
  it("receive permit details and the QR, like marketing", () => {
    // Looking up the permit for the shoot they are on is the reason the
    // registry is in this app at all.
    const [seen] = forRoles([row], ["creator"]);
    expect(seen).toEqual(row);
  });

  it("keep that access when they also lead a team", () => {
    expect(forRoles([row], ["creator", "team_lead"])[0]).toEqual(row);
  });
});

describe("the content-ops roles on their own", () => {
  it("are redacted exactly like agents", () => {
    // They hold no permit capability, so they fall through to the same
    // redaction rather than to an accidental "everything".
    const [seen] = forRoles([row], ["manager"]);
    expect(seen.permitNumber).toBeNull();
    expect(seen.qrUrl).toBeNull();
    expect(seen.dldProjectNumber).toBeNull();
  });
});
