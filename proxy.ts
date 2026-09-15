import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TOKEN } from "@/lib/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedApi =
    (pathname.startsWith("/api/admin") &&
      !pathname.startsWith("/api/admin/login")) ||
    pathname.startsWith("/api/debug");
  const isProtectedPage =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  if (isProtectedApi || isProtectedPage) {
    const session = request.cookies.get(SESSION_COOKIE);
    if (session?.value !== SESSION_TOKEN) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/debug/:path*"],
};
