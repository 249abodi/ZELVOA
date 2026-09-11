import { randomBytes } from "crypto";
import { getPlatformMeta } from "@/lib/integrations/platforms";
import { getPlatformBaseUrl } from "@/lib/integrations/registry";
import type {
  ExchangedToken,
  Platform,
  RefreshResult,
  SocialProvider,
} from "@/lib/integrations/types";

const DEV_MARKER = "zelvoa:dev";

export function isDevMarkerScope(scopes: string[]): boolean {
  return scopes.includes(DEV_MARKER);
}

export function markDev(scopes: string[]): string[] {
  return Array.from(new Set([...scopes, DEV_MARKER]));
}

/**
 * Development-only provider. It is ONLY constructed when ALLOW_DEV_PROVIDERS
 * is explicitly true and the app is not running in production. It exists so the
 * product workflows can be exercised during development. Every account created
 * through it is marked with a explicit dev sentinel and surfaced as "Development
 * mode" in the UI — it never imitates a real platform result in production.
 */
export class DevSocialProvider implements SocialProvider {
  readonly platform: Platform;
  readonly configured = false;
  readonly isDevProvider = true;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  get capabilities() {
    return getPlatformMeta(this.platform).capabilities;
  }

  buildAuthorizationUrl(opts: { state: string; redirectUri: string }): string {
    const url = new URL(`${getPlatformBaseUrl()}/api/v1/accounts/oauth/callback`);
    url.searchParams.set("platform", this.platform);
    url.searchParams.set("state", opts.state);
    url.searchParams.set("code", `dev-${randomBytes(16).toString("hex")}`);
    url.searchParams.set("dev", "1");
    void opts.redirectUri;
    return url.toString();
  }

  async exchangeCode(code: string): Promise<ExchangedToken> {
    if (!code.startsWith("dev-")) {
      throw new Error("Invalid development authorization code.");
    }
    const meta = getPlatformMeta(this.platform);
    const suffix = code.slice(4, 9);
    return {
      accessToken: `dev-access-${randomBytes(18).toString("hex")}`,
      refreshToken: `dev-refresh-${suffix}`,
      expiresInSeconds: 60 * 60 * 24 * 30,
      scopes: markDev([]),
      platformAccountId: `dev-${suffix}`,
      name: `${meta.label} (Development)`,
      username: `dev_${suffix}`,
      avatarUrl: null,
      raw: { dev: true },
    };
  }

  async refresh(_refreshToken: string): Promise<RefreshResult> {
    return {
      accessToken: `dev-access-${randomBytes(18).toString("hex")}`,
      refreshToken: _refreshToken,
      expiresInSeconds: 60 * 60 * 24 * 30,
    };
  }

  async revoke(): Promise<void> {
    return;
  }
}