-- AlterTable: Enhance AIUsageRecord with workspace tracking, status, and error handling
ALTER TABLE "AIUsageRecord" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "AIUsageRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "AIUsageRecord" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "AIUsageRecord" ADD COLUMN "durationMs" INTEGER;

-- CreateIndex
CREATE INDEX "AIUsageRecord_workspaceId_createdAt_idx" ON "AIUsageRecord"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageRecord_status_organizationId_createdAt_idx" ON "AIUsageRecord"("status", "organizationId", "createdAt");
