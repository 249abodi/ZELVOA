-- AlterEnum
-- Adds token-expired and oauth-failure notification types. Uses IF NOT EXISTS
-- because this migration is safe to apply on databases that were created with
-- a partial or conflicting migration history.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOKEN_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OAUTH_CONNECT_FAILED';