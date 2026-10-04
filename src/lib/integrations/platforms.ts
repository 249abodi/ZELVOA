import type { IconName } from "@/components/icons";
import type { Platform, ProviderCapabilities } from "@/lib/integrations/types";

export interface PlatformLimits {
  captionLimit: number;
  firstCommentLimit: number;
  mediaRequired: boolean;
  supportsCarousel: boolean;
}

export interface PlatformMeta {
  platform: Platform;
  label: string;
  icon: IconName;
  capabilities: ProviderCapabilities;
  authUrlBuilder: "oauth2" | "oauth2-pkce-global";
  envClientId: string;
  envClientSecret: string;
  iconClass: string;
  publishingImplemented: boolean;
  limits: PlatformLimits;
  docsUrl: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  INSTAGRAM: {
    platform: "INSTAGRAM",
    label: "Instagram",
    icon: "instagram",
    capabilities: { publish: true, schedule: true, messaging: true, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "INSTAGRAM_CLIENT_ID",
    envClientSecret: "INSTAGRAM_CLIENT_SECRET",
    iconClass: "bg-accent-100 text-accent-600 dark:bg-accent-600/30 dark:text-accent-300",
    publishingImplemented: true,
    limits: {
      captionLimit: 2200,
      firstCommentLimit: 2200,
      mediaRequired: true,
      supportsCarousel: true,
    },
    docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
  },
  FACEBOOK: {
    platform: "FACEBOOK",
    label: "Facebook",
    icon: "facebook",
    capabilities: { publish: true, schedule: true, messaging: true, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "FACEBOOK_CLIENT_ID",
    envClientSecret: "FACEBOOK_CLIENT_SECRET",
    iconClass: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300",
    publishingImplemented: true,
    limits: {
      captionLimit: 63206,
      firstCommentLimit: 2200,
      mediaRequired: false,
      supportsCarousel: true,
    },
    docsUrl: "https://developers.facebook.com/docs/graph-api/reference/page/feed",
  },
  TIKTOK: {
    platform: "TIKTOK",
    label: "TikTok",
    icon: "tiktok",
    capabilities: { publish: true, schedule: false, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "TIKTOK_CLIENT_ID",
    envClientSecret: "TIKTOK_CLIENT_SECRET",
    iconClass: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
    publishingImplemented: false,
    limits: {
      captionLimit: 2200,
      firstCommentLimit: 0,
      mediaRequired: true,
      supportsCarousel: false,
    },
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
  },
  LINKEDIN: {
    platform: "LINKEDIN",
    label: "LinkedIn",
    icon: "linkedin",
    capabilities: { publish: true, schedule: true, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "LINKEDIN_CLIENT_ID",
    envClientSecret: "LINKEDIN_CLIENT_SECRET",
    iconClass: "bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300",
    publishingImplemented: true,
    limits: {
      captionLimit: 3000,
      firstCommentLimit: 0,
      mediaRequired: false,
      supportsCarousel: false,
    },
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },
  X: {
    platform: "X",
    label: "X",
    icon: "xtwitter",
    capabilities: { publish: true, schedule: true, messaging: false, analytics: true },
    authUrlBuilder: "oauth2-pkce-global",
    envClientId: "X_CLIENT_ID",
    envClientSecret: "X_CLIENT_SECRET",
    iconClass: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
    publishingImplemented: true,
    limits: {
      captionLimit: 280,
      firstCommentLimit: 0,
      mediaRequired: false,
      supportsCarousel: false,
    },
    docsUrl: "https://developer.x.com/en/docs/x-api/tweets/manage-tweets",
  },
  YOUTUBE: {
    platform: "YOUTUBE",
    label: "YouTube",
    icon: "video",
    capabilities: { publish: true, schedule: false, messaging: false, analytics: true },
    authUrlBuilder: "oauth2",
    envClientId: "YOUTUBE_CLIENT_ID",
    envClientSecret: "YOUTUBE_CLIENT_SECRET",
    iconClass: "bg-destructive/10 text-destructive dark:bg-destructive/20",
    publishingImplemented: false,
    limits: {
      captionLimit: 5000,
      firstCommentLimit: 0,
      mediaRequired: true,
      supportsCarousel: false,
    },
    docsUrl: "https://developers.google.com/youtube/v3/docs/videos/insert",
  },
};

const CAPABILITY_LABELS: Record<keyof ProviderCapabilities, string> = {
  publish: "Publish",
  schedule: "Schedule",
  messaging: "Messaging",
  analytics: "Analytics",
};

export function serializeCapabilities(capabilities: ProviderCapabilities): string[] {
  return (Object.keys(CAPABILITY_LABELS) as (keyof ProviderCapabilities)[])
    .filter((key) => capabilities[key])
    .map((key) => CAPABILITY_LABELS[key]);
}

export function getPlatformMeta(platform: Platform): PlatformMeta {
  return PLATFORM_META[platform];
}

export function getCapabilities(platform: Platform): ProviderCapabilities {
  return PLATFORM_META[platform].capabilities;
}

export function getPlatformLimits(platform: Platform): PlatformLimits {
  return PLATFORM_META[platform].limits;
}

export function isPublishingImplemented(platform: Platform): boolean {
  return PLATFORM_META[platform].publishingImplemented;
}
