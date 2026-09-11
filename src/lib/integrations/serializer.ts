import type { SocialAccount, SocialAccountToken } from "@prisma/client";
import { isDevMarkerScope } from "@/lib/integrations/dev-provider";

export interface AccountSummary {
  id: string;
  platform: string;
  platformAccountId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  lastSyncAt: string | null;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  isDev: boolean;
  token: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt: string | null;
    expired: boolean;
    expiresSoon: boolean;
  } | null;
}

export function serializeAccount(
  account: SocialAccount,
  token?: SocialAccountToken | null
): AccountSummary {
  const hasAccess = Boolean(token?.encryptedAccessToken);
  const hasRefresh = Boolean(token?.encryptedRefreshToken);
  const expiresAt = token?.tokenExpiresAt ?? null;
  const expired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  const expiresSoon = Boolean(
    expiresAt &&
      !expired &&
      expiresAt.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 7
  );

  return {
    id: account.id,
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    name: account.name,
    username: account.username,
    avatarUrl: account.avatarUrl,
    status: account.status,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    scopes: account.scopes,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    isDev: isDevMarkerScope(account.scopes),
    token: {
      hasAccessToken: hasAccess,
      hasRefreshToken: hasRefresh,
      expiresAt: expiresAt?.toISOString() ?? null,
      expired,
      expiresSoon,
    },
  };
}