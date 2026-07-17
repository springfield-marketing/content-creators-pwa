// Role gates (§B7): /admin + /api/admin → manager, /creator + /api/me →
// creator, /reports + /api/reports → executive or manager. Public routes
// (/book, /booking, public APIs) are not matched at all.
//
// Roles are a set, so a path can be reachable by several of them: team_lead
// gets the review screen and nothing else under /admin.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@/auth";
import { homeFor } from "@/lib/roles";

// FIRST MATCH WINS — the review entries must stay above the general /admin
// ones, or a team_lead is bounced from the only screen they're here for.
const ROUTE_ROLES: [string, Role[]][] = [
  ["/admin/review", ["manager", "team_lead"]],
  ["/api/admin/review-queue", ["manager", "team_lead"]],
  ["/api/admin/deliverables", ["manager", "team_lead"]],
  ["/admin", ["manager"]],
  ["/api/admin", ["manager"]],
  ["/creator", ["creator"]],
  ["/api/me", ["creator"]],
  ["/reports", ["executive", "manager"]],
  ["/api/reports", ["executive", "manager"]],
];

function allowed(pathname: string, roles: Role[]): boolean {
  const rule = ROUTE_ROLES.find(([prefix]) => pathname.startsWith(prefix));
  if (!rule) return true;
  return rule[1].some((r) => roles.includes(r));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const roles = req.auth?.user?.roles ?? [];

  if (!req.auth) {
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (!allowed(pathname, roles)) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(homeFor(roles), req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/creator/:path*",
    "/reports/:path*",
    "/api/admin/:path*",
    "/api/me/:path*",
    "/api/reports/:path*",
  ],
};
