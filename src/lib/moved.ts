// Moved mode (BOOKING_MOVED=1): booking, the creators' screens and the managers' booking screens moved to the Springfield
// dashboard (DASHBOARD_URL) and agents book in the Calls app (CALLS_APP_URL). This app keeps only the permits registry
// until that moves too. Old links land on the new pages; nothing here writes a booking any more (never two writers), and
// the crons and the calendar webhook stand down.

export type Moved =
  | { kind: "redirect"; to: string }
  | { kind: "gone" } // a booking write from a page still open: refused
  | { kind: "idle" }; // a cron or a webhook: answered 200, nothing done

// The dashboard's Content pages as built (13-11-2026): Overview (the creators' month against their targets: the KPIs), Calendar,
// Review (its log a tab) and Creators (the week plan inside). Agents, KPIs, targets and team have no page of their own there.
const ADMIN: [string, string][] = [
  ["/admin/schedule", "/app/content/creators"],
  ["/admin/creators", "/app/content/creators"],
  ["/admin/review-log", "/app/content/review?tab=log"],
  ["/admin/review", "/app/content/review"],
  ["/admin/bookings", "/app/content/calendar"],
  ["/admin/kpis", "/app/content"],
  ["/admin/targets", "/app/content"],
  ["/admin/team", "/app/content"],
  ["/admin/agents", "/app/content"],
];

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}-`);

export function movedTo(pathname: string, env: Record<string, string | undefined> = process.env): Moved | null {
  if (env.BOOKING_MOVED !== "1") return null;
  const dashboard = (env.DASHBOARD_URL ?? "").replace(/\/+$/, "");
  const calls = (env.CALLS_APP_URL ?? "").replace(/\/+$/, "");

  // Still here: the permits registry (the creators' permits page too), signing in to it, its expiry cron.
  if (["/permits", "/admin/permits", "/creator/permits", "/api/permits", "/api/admin/permits", "/login", "/api/auth", "/api/cron/permit-expiry"].some((p) => under(pathname, p))) {
    return null;
  }
  if (under(pathname, "/book")) return { kind: "redirect", to: `${calls}/shoots/new` };
  if (under(pathname, "/booking")) return { kind: "redirect", to: `${calls}/shoots` };
  if (under(pathname, "/creator")) return { kind: "redirect", to: `${dashboard}/creator` };
  if (under(pathname, "/reports")) return { kind: "redirect", to: `${dashboard}/app/content` };
  if (under(pathname, "/admin")) {
    const hit = ADMIN.find(([from]) => under(pathname, from));
    return { kind: "redirect", to: `${dashboard}${hit ? hit[1] : "/app/content"}` };
  }
  if (pathname === "/api/leaderboard") return { kind: "redirect", to: `${dashboard}/api/content/leaderboard` };
  if (under(pathname, "/api/cron") || under(pathname, "/api/webhooks")) return { kind: "idle" };
  if (under(pathname, "/api")) return { kind: "gone" };

  return null;
}
