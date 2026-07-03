// Role gates (§B7): /admin + /api/admin → manager, /creator + /api/me →
// creator, /reports + /api/reports → executive or manager. Public routes
// (/book, /booking, public APIs) are not matched at all.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const roleHome: Record<string, string> = {
  creator: "/creator",
  manager: "/admin/review",
  executive: "/reports",
};

function allowed(pathname: string, role: string | undefined): boolean {
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return role === "manager";
  }
  if (pathname.startsWith("/creator") || pathname.startsWith("/api/me")) {
    return role === "creator";
  }
  if (pathname.startsWith("/reports") || pathname.startsWith("/api/reports")) {
    return role === "executive" || role === "manager";
  }
  return true;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const role = req.auth?.user?.role;

  if (!req.auth) {
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (!allowed(pathname, role)) {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(
      new URL(roleHome[role ?? ""] ?? "/login", req.nextUrl)
    );
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
