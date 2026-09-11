import { prisma } from "@/lib/db";

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per file
export const DEFAULT_STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GiB

export function defaultQuotaBytes(): number {
  const env = process.env.MEDIA_STORAGE_QUOTA_BYTES;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return DEFAULT_STORAGE_QUOTA_BYTES;
}

export async function getWorkspaceStorageQuotaBytes(workspaceId: string): Promise<number> {
  // Phase 9 replaces this with the plan-backed quota. The env override exists
  // only as an operational lever, not as fake data.
  void workspaceId;
  return defaultQuotaBytes();
}

export async function getWorkspaceStorageUsageBytes(workspaceId: string): Promise<number> {
  const agg = await prisma.mediaAsset.aggregate({
    where: { workspaceId, deletedAt: null },
    _sum: { sizeBytes: true },
  });
  return agg._sum.sizeBytes ?? 0;
}

export async function assertStorageQuotaAvailable(
  workspaceId: string,
  additionalBytes: number,
  quota?: number
): Promise<number> {
  const quotaBytes = quota ?? (await getWorkspaceStorageQuotaBytes(workspaceId));
  const used = await getWorkspaceStorageUsageBytes(workspaceId);
  if (used + additionalBytes > quotaBytes) {
    throw new Error("Storage quota exceeded. Free up space or upgrade your plan.");
  }
  return quotaBytes;
}