-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'POST_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_CONNECTED';
ALTER TYPE "NotificationType" ADD VALUE 'TOKEN_EXPIRING';

-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3);
