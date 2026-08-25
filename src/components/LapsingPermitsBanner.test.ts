import { describe, expect, it } from "vitest";
import { lapsingMessage } from "./LapsingPermitsBanner";
import type { LapsingPermit } from "@/lib/registry/queries";

const permit = (
  name: string,
  listingEnd: string,
  daysLeft: number,
): LapsingPermit => ({
  id: 1,
  name,
  category: "offplan",
  permitNumber: "1234567890",
  listingEnd,
  daysLeft,
});

describe("lapsingMessage", () => {
  it("says nothing when nothing is lapsing", () => {
    expect(lapsingMessage([])).toBeNull();
  });

  it("names them while there are few enough to act on one by one", () => {
    expect(
      lapsingMessage([
        permit("Greenz by Danube", "2026-07-08", -48),
        permit("Masaar 2", "2026-09-04", 10),
      ]),
    ).toBe("Greenz by Danube expired 8 Jul · Masaar 2 expires 4 Sep");
  });

  it("counts them once naming them stops being a notification", () => {
    // The real shape: 389 permits share 15 Oct, so the banner has to lead with
    // the date rather than the list.
    const rows = Array.from({ length: 389 }, (_, i) =>
      permit(`Project ${i}`, "2026-10-15", 51),
    );
    expect(lapsingMessage(rows)).toBe("389 permits expire 15 Oct");
  });

  it("separates the soonest date from the rest of the window", () => {
    const rows = [
      permit("Masaar 2", "2026-09-04", 10),
      permit("Masaar 3", "2026-09-04", 10),
      ...Array.from({ length: 389 }, (_, i) =>
        permit(`Project ${i}`, "2026-10-15", 51),
      ),
    ];
    expect(lapsingMessage(rows)).toBe(
      "2 permits expire 4 Sep, 389 more within 60 days",
    );
  });

  it("agrees with itself about number", () => {
    // "2 permits expires 4 Sep" was the first draft of this.
    const one = [
      permit("Masaar 2", "2026-09-04", 10),
      ...Array.from({ length: 4 }, (_, i) =>
        permit(`Project ${i}`, "2026-10-15", 51),
      ),
    ];
    expect(lapsingMessage(one)).toContain("1 permit expires 4 Sep");
    expect(lapsingMessage(one)).not.toContain("1 permits");
  });

  it("counts expired ones too rather than listing a wall of them", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      permit(`Old ${i}`, "2026-04-30", -117),
    );
    expect(lapsingMessage(rows)).toBe("6 permits have expired");
  });
});
