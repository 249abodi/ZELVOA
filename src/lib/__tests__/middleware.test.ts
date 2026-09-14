import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE } from "@/lib/auth";
import { signSession } from "@/lib/session";

const TEST_SECRET = "test-only-secret-do-not-use-0123456789abcdef";

vi.mock("@/lib/security-headers", () => ({
  buildSecurityHeaders: () => ({}),
  buildCspHeader: () => "",
  cspEnabled: () => false,
}));

function makeRequest(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", `${SESSION_COOKIE}=${cookie}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

async function responseStatus(res: Awaited<ReturnType<typeof middleware>>) {
  return (res as NextResponse).status;
}

describe("middleware auth redirects", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  test("renders the login page when no session cookie is present", async () => {
    const res = await middleware(makeRequest("/login"));
    expect(await responseStatus(res)).toBe(200);
  });

  test("redirects unauthenticated app requests to login", async () => {
    const res = await middleware(makeRequest("/app/dashboard"));
    expect(await responseStatus(res)).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fapp%2Fdashboard"
    );
  });

  test("renders login with an invalid session cookie instead of bouncing to the app", async () => {
    const res = await middleware(
      makeRequest("/login", "eyJhbGciOiJIUzI1NiJ9.invalid.token")
    );
    expect(await responseStatus(res)).toBe(200);
  });

  test("redirects signed-in users away from the login page", async () => {
    const token = await signSession({ sub: "user-1", org: "org-1", ws: "ws-1", role: "OWNER" });
    const res = await middleware(makeRequest("/login", token));
    expect(await responseStatus(res)).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/app/dashboard");
  });

  test("invalid session cookie on app routes passes through for server-side rejection", async () => {
    const res = await middleware(
      makeRequest("/app/dashboard", "eyJhbGciOiJIUzI1NiJ9.invalid.token")
    );
    expect(await responseStatus(res)).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});