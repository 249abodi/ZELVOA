-- CreateTable
CREATE TABLE "PendingPageSelection" (
    "id" TEXT NOT NULL,
    "oauthStateId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingPageSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPageSelection_oauthStateId_key" ON "PendingPageSelection"("oauthStateId");

-- CreateIndex
CREATE INDEX "PendingPageSelection_workspaceId_idx" ON "PendingPageSelection"("workspaceId");

-- CreateIndex
CREATE INDEX "PendingPageSelection_expiresAt_idx" ON "PendingPageSelection"("expiresAt");

-- CreateIndex
CREATE INDEX "PendingPageSelection_userId_idx" ON "PendingPageSelection"("userId");

-- AddForeignKey
ALTER TABLE "PendingPageSelection" ADD CONSTRAINT "PendingPageSelection_oauthStateId_fkey" FOREIGN KEY ("oauthStateId") REFERENCES "OAuthState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingPageSelection" ADD CONSTRAINT "PendingPageSelection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
