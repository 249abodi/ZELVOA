import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  const isAppRoute = pathname.startsWith("/app") || pathname === "/welcome";
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // If a signed-in user tries to visit auth pages, send them to the app.
  if (isPublic && session) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  if (isAppRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register"],
};