import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface AuditInput {
  organizationId?: string | null;
  workspaceId?: string | null;
  actorId?: string | null;
  socialAccountId?: string | null;
  postId?: string | null;
  mediaAssetId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog
    .create({
      data: {
        organizationId: input.organizationId ?? null,
        workspaceId: input.workspaceId ?? null,
        actorId: input.actorId ?? null,
        socialAccountId: input.socialAccountId ?? null,
        postId: input.postId ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
      },
    })
    .catch(() => undefined);
}