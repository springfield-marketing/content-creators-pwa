import { describe, expect, it } from "vitest";
import { movedTo } from "./moved";

const env = { BOOKING_MOVED: "1", DASHBOARD_URL: "https://dashboard.example/", CALLS_APP_URL: "https://calls.example" };

describe("moved mode", () => {
  it("changes nothing until switched on", () => {
    expect(movedTo("/book/abhinay", {})).toBeNull();
    expect(movedTo("/api/bookings", { ...env, BOOKING_MOVED: "0" })).toBeNull();
  });

  it("sends booking to the Calls app and the rest to the dashboard", () => {
    expect(movedTo("/book", env)).toEqual({ kind: "redirect", to: "https://calls.example/shoots/new" });
    // IMP-417: a creator's own link opens with that creator picked.
    expect(movedTo("/book/abhinay", env)).toEqual({ kind: "redirect", to: "https://calls.example/shoots/new?creator=abhinay" });
    expect(movedTo("/book/abhinay/details", env)).toEqual({ kind: "redirect", to: "https://calls.example/shoots/new?creator=abhinay" });
    expect(movedTo("/book/Not%20A%20Slug", env)).toEqual({ kind: "redirect", to: "https://calls.example/shoots/new" });
    expect(movedTo("/booking/5b0c7a52", env)).toEqual({ kind: "redirect", to: "https://calls.example/shoots" });
    expect(movedTo("/creator/log", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/creator" });
    expect(movedTo("/admin", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content" });
    expect(movedTo("/admin/review-log", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content/review?tab=log" });
    expect(movedTo("/admin/schedule", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content/creators" });
    expect(movedTo("/admin/kpis", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content" });
    expect(movedTo("/admin/bookings/7", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content/calendar" });
    expect(movedTo("/reports", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content" });
    expect(movedTo("/api/leaderboard", env)).toEqual({ kind: "redirect", to: "https://dashboard.example/api/content/leaderboard" });
  });

  it("refuses booking writes, stands the crons and the calendar webhook down, keeps the permits", () => {
    expect(movedTo("/api/bookings", env)).toEqual({ kind: "gone" });
    expect(movedTo("/api/me/deliverables", env)).toEqual({ kind: "gone" });
    expect(movedTo("/api/admin/bookings/1", env)).toEqual({ kind: "gone" });
    expect(movedTo("/api/cron/complete-past-bookings", env)).toEqual({ kind: "idle" });
    expect(movedTo("/api/webhooks/google-calendar", env)).toEqual({ kind: "idle" });
    for (const kept of ["/permits", "/permits/requests", "/admin/permits", "/creator/permits", "/api/permits/issue", "/api/admin/permits/3", "/api/cron/permit-expiry", "/login", "/api/auth/session"]) {
      expect(movedTo(kept, env)).toBeNull();
    }
  });
  it("sends permits to the dashboard once they've moved too (PERMITS_MOVED=1)", () => {
    const both = { ...env, PERMITS_MOVED: "1" };
    expect(movedTo("/admin/permits", both)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content/permits" });
    expect(movedTo("/admin/permits/requests", both)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content/permits" });
    expect(movedTo("/permits", both)).toEqual({ kind: "redirect", to: "https://dashboard.example/app/content/permits" });
    expect(movedTo("/creator/permits", both)).toEqual({ kind: "redirect", to: "https://dashboard.example/creator/permits" });
    expect(movedTo("/api/permits/issue", both)).toEqual({ kind: "gone" });
    expect(movedTo("/api/admin/permits/3", both)).toEqual({ kind: "gone" });
    expect(movedTo("/api/cron/permit-expiry", both)).toEqual({ kind: "idle" });
    expect(movedTo("/login", both)).toBeNull();
  });

  it("sends the front page to Book a shoot once permits have moved too (IMP-417)", () => {
    expect(movedTo("/", { ...env, PERMITS_MOVED: "1" })).toEqual({ kind: "redirect", to: "https://calls.example/shoots/new" });
    // Permits still here: the front page stays the sign-in to them.
    expect(movedTo("/", env)).toBeNull();
  });
});
