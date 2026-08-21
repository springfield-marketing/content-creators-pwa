import { describe, expect, it } from "vitest";
import { ALERT_DAYS, bucketByExpiry } from "./expiry";

const TODAY = "2026-08-06";

const p = (id: number, listingEnd: string | null) => ({
  id,
  name: `P${id}`,
  dldProjectNumber: String(id),
  permitNumber: "0123456789",
  listingEnd,
});

describe("bucketByExpiry", () => {
  it("puts a lapsed permit in expired", () => {
    const r = bucketByExpiry([p(1, "2026-08-05")], TODAY);
    expect(r.expired.map((x) => x.id)).toEqual([1]);
  });

  it("files each permit in the tightest bucket it fits", () => {
    const r = bucketByExpiry(
      [
        p(1, "2026-08-10"), // 4 days  -> 7
        p(2, "2026-08-19"), // 13 days -> 14
        p(3, "2026-09-01"), // 26 days -> 30
        p(4, "2026-10-01"), // 56 days -> 60
      ],
      TODAY,
    );
    expect(r.dueIn[7].map((x) => x.id)).toEqual([1]);
    expect(r.dueIn[14].map((x) => x.id)).toEqual([2]);
    expect(r.dueIn[30].map((x) => x.id)).toEqual([3]);
    expect(r.dueIn[60].map((x) => x.id)).toEqual([4]);
  });

  it("counts a permit expiring exactly on a threshold in that bucket", () => {
    const r = bucketByExpiry([p(1, "2026-08-13")], TODAY); // exactly 7
    expect(r.dueIn[7].map((x) => x.id)).toEqual([1]);
  });

  it("ignores permits further out than the widest alert", () => {
    const r = bucketByExpiry([p(1, "2027-01-01")], TODAY);
    expect(r.expired).toEqual([]);
    for (const d of ALERT_DAYS) expect(r.dueIn[d]).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("ignores projects with no permit at all", () => {
    const r = bucketByExpiry([p(1, null)], TODAY);
    expect(r.total).toBe(0);
  });

  it("totals everything that needs attention", () => {
    const r = bucketByExpiry(
      [p(1, "2026-08-05"), p(2, "2026-08-10"), p(3, "2027-01-01")],
      TODAY,
    );
    expect(r.total).toBe(2);
  });

  it("orders each bucket by soonest first", () => {
    const r = bucketByExpiry([p(1, "2026-08-12"), p(2, "2026-08-08")], TODAY);
    expect(r.dueIn[7].map((x) => x.id)).toEqual([2, 1]);
  });
});
