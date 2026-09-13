import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  buildSecurityHeaders,
  buildCspHeader,
  cspEnabled,
} from "@/lib/security-headers";

const PUBLIC_PATHS = ["/login", "/register"];
const ADMIN_PATHS = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const env = process.env.NODE_ENV;

  const isAppRoute =
    pathname.startsWith("/app") ||
    pathname === "/welcome" ||
    ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const response = NextResponse.next();

  const headers = buildSecurityHeaders({ production: env === "production" });
  if (cspEnabled()) {
    const nonceBuffer = new Uint8Array(16);
    crypto.getRandomValues(nonceBuffer);
    const nonce = btoa(String.fromCharCode(...nonceBuffer)).replace(/\W/g, "").slice(0, 22);
    headers["Content-Security-Policy"] = buildCspHeader(nonce);
    response.headers.set("X-Nonce", nonce);
  }
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  // If a signed-in user tries to visit auth pages, send them to the app.
  if (isPublic && session) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  if (isAppRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/api/:path*", "/login", "/register"],
};