import { describe, it, expect } from "vitest";
import { assessOAuthState, buildAccountsRedirect } from "@/lib/integrations/oauth";
import type { OAuthState } from "@prisma/client";

function makeState(overrides: Partial<OAuthState> = {}): OAuthState {
  return {
    id: "st_1",
    organizationId: "org_1",
    workspaceId: "ws_1",
    platform: "INSTAGRAM",
    state: "state-abc",
    redirectUri: "http://localhost:3000/api/v1/accounts/oauth/callback",
    connectsTo: null,
    consumedAt: null,
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    ipAddress: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("assessOAuthState", () => {
  it("reports missing state", () => {
    const result = assessOAuthState(null, NOW);
    expect(result.missing).toBe(true);
    expect(result.error).toBe("invalid_oauth_state");
  });

  it("rejects already-consumed state", () => {
    const result = assessOAuthState(makeState({ consumedAt: NOW }), NOW);
    expect(result.error).toBe("oauth_state_already_used");
  });

  it("rejects expired state", () => {
    const result = assessOAuthState(
      makeState({ expiresAt: new Date("2025-12-31T23:59:59.000Z") }),
      NOW
    );
    expect(result.error).toBe("oauth_state_expired");
  });

  it("accepts a valid, unconsumed, unexpired state", () => {
    const result = assessOAuthState(makeState(), NOW);
    expect(result.error).toBeUndefined();
    expect(result.record?.state).toBe("state-abc");
  });

  it("treats exactly-expiring states as still valid", () => {
    const result = assessOAuthState(
      makeState({ expiresAt: NOW }),
      NOW
    );
    expect(result.error).toBeUndefined();
  });
});

describe("buildAccountsRedirect", () => {
  it("redirects to the accounts page with success flag", () => {
    const url = buildAccountsRedirect("s1", { base: "http://localhost:3000", connected: true });
    expect(url).toContain("/app/accounts");
    expect(url).toContain("connected=true");
  });

  it("redirects with the error signal on failure", () => {
    const url = buildAccountsRedirect("s1", { base: "http://localhost:3000", error: "oops" });
    expect(url).toContain("connect_error=oops");
    expect(url).toContain("connect_error_code=oauth_error");
  });

  it("never leaks the callback query into the app", () => {
    const url = buildAccountsRedirect("s1", { base: "http://localhost:3000", connected: true });
    expect(url).not.toContain("code=");
    expect(url).not.toContain("dev_token=");
  });
});