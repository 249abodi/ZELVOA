import type { OAuthState } from "@prisma/client";

export interface StateError {
  error?: string;
  record?: OAuthState;
  missing?: boolean;
}

/**
 * Validates a persisted OAuth state record against attack/safety rules.
 * Kept as a pure function so the callback route is thin and testable.
 */
export function assessOAuthState(
  record: OAuthState | null,
  now: Date
): StateError {
  if (!record) return { missing: true, error: "invalid_oauth_state" };
  if (record.consumedAt) return { record, error: "oauth_state_already_used" };
  if (record.expiresAt.getTime() < now.getTime()) {
    return { record, error: "oauth_state_expired" };
  }
  return { record };
}

export function buildAccountsRedirect(
  state: string,
  options: { base: string; error?: string; connected?: boolean }
): string {
  const url = new URL("/app/accounts", options.base);
  if (state) url.searchParams.set("state_consumed", state);
  if (options.error) {
    url.searchParams.set("connect_error", options.error);
    url.searchParams.set("connect_error_code", "oauth_error");
  } else if (options.connected) {
    url.searchParams.set("connected", "true");
  }
  return url.toString();
}