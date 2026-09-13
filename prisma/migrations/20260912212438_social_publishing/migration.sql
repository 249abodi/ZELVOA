-- AlterEnum
-- Order-safe reconciliation:
-- This migration originally assumed the base schema already existed, but it
-- sorts BEFORE the `init` migration (20260913120000) by folder name. On a
-- fresh `prisma migrate deploy` it is replayed first, so these statements are
-- guarded to be a no-op when the type/table do not exist yet. The
-- 20260913120002_reconcile_social_publishing migration guarantees the final
-- enum values and columns regardless of replay order.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'POST_SCHEDULED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_CONNECTED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOKEN_EXPIRING';
  END IF;
END $$;

-- AlterTable
ALTER TABLE IF EXISTS "ScheduledPost" ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);