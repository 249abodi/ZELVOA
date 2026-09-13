-- ReconcileSocialPublishing
-- Ensures the final schema matches schema.prisma regardless of replay order.
-- On a fresh `prisma migrate deploy`, 20260912212438_social_publishing is
-- replayed BEFORE 20260913120000_init (folder-name sort order) and is a no-op
-- because the type/table do not exist yet. init then creates the base schema
-- WITHOUT these values/columns, so this migration adds them to converge on the
-- same final state as databases where social_publishing applied normally.
-- On existing databases these statements are already satisfied (no-op).

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'POST_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_CONNECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOKEN_EXPIRING';

-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);