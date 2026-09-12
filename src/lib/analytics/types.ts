import type { PlatformType } from "@prisma/client";

export interface SnapshotData {
  postId?: string;
  socialAccountId?: string;
  platform?: PlatformType;
  periodStart: Date;
  periodEnd: Date;
  followers: number;
  reach: number;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export interface AnalyticsTimeSeries {
  date: string;
  followers: number;
  reach: number;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export interface TopPostData {
  postId: string;
  title: string | null;
  content: string;
  platform: string | null;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  publishedAt: Date | null;
}