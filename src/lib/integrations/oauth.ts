import type { OAuthState } from "@prisma/client";
import { PublishingError } from "@/lib/publishing/errors";

export interface StateError {
  error?: string;
  record?: OAuthState;
  missing?: boolean;
}

export function oauthCallbackCode(error: unknown): string {
  if (error instanceof PublishingError) {
    switch (error.code) {
      case "AUTH_EXPIRED":
      case "NOT_CONFIGURED":
        return "oauth_token_exchange_failed";
      case "PROVIDER_PERMISSION":
        return "oauth_discovery_failed";
      case "PROVIDER_RATE_LIMITED":
        return "provider_rate_limited";
      case "PROVIDER_DUPLICATE":
      case "PROVIDER_ERROR":
      default:
        return "provider_api_error";
    }
  }
  return "provider_error";
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