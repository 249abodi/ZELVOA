import { getRegistryEntry } from "@/lib/integrations/registry";
import type { Platform, SocialProvider } from "@/lib/integrations/types";
import { OAuth2SocialProvider } from "@/lib/integrations/oauth-provider";
import { DevSocialProvider } from "@/lib/integrations/dev-provider";

export function getProvider(platform: Platform): SocialProvider {
  const entry = getRegistryEntry(platform);
  if (entry.devMode) return new DevSocialProvider(platform);
  return new OAuth2SocialProvider(platform);
}

export function resolveAccountStatus(
  configured: boolean,
  dev: boolean,
  hasToken: boolean,
  tokenExpiresAt: Date | null,
  hasRefresh: boolean
): {
  status: "CONNECTED" | "EXPIRED" | "ERROR" | "NOT_CONFIGURED";
  reason?: string;
} {
  if (!configured && !dev) {
    return { status: "NOT_CONFIGURED", reason: "Provider credentials not configured." };
  }
  if (!hasToken) {
    return { status: "ERROR", reason: "No access token stored." };
  }
  if (tokenExpiresAt && tokenExpiresAt.getTime() <= Date.now() && !hasRefresh) {
    return { status: "EXPIRED", reason: "Token expired and no refresh token is available." };
  }
  return { status: "CONNECTED" };
}