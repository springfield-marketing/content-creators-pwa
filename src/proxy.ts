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

//
// Moved mode (@/lib/moved, BOOKING_MOVED=1) comes first, on every path: booking and its screens live in the Springfield
// dashboard and the Calls app; only the permits registry stays here.

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { allowed } from "@/lib/route-access";
import { movedTo } from "@/lib/moved";
import { homeFor } from "@/lib/roles";

const GATED = ["/admin", "/creator", "/reports", "/permits", "/api/admin", "/api/me", "/api/reports", "/api/permits"];

const gated = auth((req) => {
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

export default async function proxy(req: NextRequest, ctx: unknown) {
  const { pathname } = req.nextUrl;
  const moved = movedTo(pathname);
  if (moved?.kind === "redirect") return NextResponse.redirect(moved.to);
  if (moved?.kind === "gone") {
    return NextResponse.json({ error: "Booking moved to the Springfield dashboard." }, { status: 410 });
  }
  if (moved?.kind === "idle") return NextResponse.json({ ok: true, moved: true });

  if (GATED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return (gated as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(req, ctx);
  }
  return NextResponse.next();
}

export const config = {
  // Every page and API (moved mode looks at each); Next's own files and the static ones aren't.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|json|webmanifest)$).*)"],
};
