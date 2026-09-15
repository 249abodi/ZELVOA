import { getPlatformMeta } from "@/lib/integrations/platforms";
import { ALL_PLATFORMS, type Platform } from "@/lib/integrations/types";

export interface RegistryEntry {
  platform: Platform;
  configured: boolean;
  devMode: boolean;
  reason: string;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function areDevProvidersAllowed(): boolean {
  return !isProduction() && process.env.ALLOW_DEV_PROVIDERS === "true";
}

export function getProviderCredentials(platform: Platform): {
  clientId: string;
  clientSecret: string;
} | null {
  if (platform === "INSTAGRAM") {
    const meta = getPlatformMeta("INSTAGRAM");
    const unified = getProviderCredentials("FACEBOOK");
    if (unified) return unified;
    const clientId = process.env[meta.envClientId]?.trim();
    const clientSecret = process.env[meta.envClientSecret]?.trim();
    if (clientId && clientSecret) return { clientId, clientSecret };
    return null;
  }
  const meta = getPlatformMeta(platform);
  const clientId = process.env[meta.envClientId]?.trim();
  const clientSecret = process.env[meta.envClientSecret]?.trim();
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  return null;
}

export function isProviderConfigured(platform: Platform): boolean {
  return getProviderCredentials(platform) !== null;
}

export function getRegistryEntry(platform: Platform): RegistryEntry {
  if (isProviderConfigured(platform)) {
    return { platform, configured: true, devMode: false, reason: "Credentials configured." };
  }
  if (areDevProvidersAllowed()) {
    return {
      platform,
      configured: false,
      devMode: true,
      reason:
        "No production credentials configured. Development providers are enabled by ALLOW_DEV_PROVIDERS.",
    };
  }
  return {
    platform,
    configured: false,
    devMode: false,
    reason:
      platform === "INSTAGRAM"
        ? `Add the Meta app credentials (FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET) or INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET to enable this integration.`
        : `Add ${getPlatformMeta(platform).envClientId} and ${getPlatformMeta(platform).envClientSecret} to enable this integration.`,
  };
}

export function listProviderEntries(): RegistryEntry[] {
  return ALL_PLATFORMS.map((p) => getRegistryEntry(p));
}

export function resolvePublicBaseUrl(candidate?: string | null): string {
  const source =
    (candidate ?? "").trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  if (source) {
    try {
      const url = new URL(source);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.origin;
      }
    } catch {
      // invalid configured base falls through to the next source
    }
  }
  return "http://localhost:3000";
}

export function getPlatformBaseUrl(origin?: string): string {
  return resolvePublicBaseUrl(origin);
}