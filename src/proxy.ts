// Role gates (§B7): /admin + /api/admin → manager, /creator + /api/me →
// creator, /reports + /api/reports → executive or manager, /permits → the
// registry roles. Public routes (/book, /booking, public APIs) are not matched
// at all.
//
// Roles are a set, so a path can be reachable by several of them: team_lead
// gets the review screen and nothing else under /admin.
//
// The table and the matching rule live in @/lib/route-access so they can be
// tested without Auth.js; this file is the wiring.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowed } from "@/lib/route-access";
import { homeFor } from "@/lib/roles";

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
    "/permits/:path*",
    "/api/admin/:path*",
    "/api/me/:path*",
    "/api/reports/:path*",
    "/api/permits/:path*",
  ],
};
