import { prisma } from "@/lib/db";
import { devInboundForAccount, describeInboxSupport, hasDevScope } from "@/lib/inbox/source";

export interface SyncSummary {
  fetchedConversations: number;
  fetchedMessages: number;
  unsupported: { accountId: string; platform: string; reason: string }[];
  devMode: boolean;
}

function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_PROVIDERS === "true";
}

/**
 * Pulls inbound conversations/messages for a workspace. Only dev-marked
 * accounts produce synthetic dev data (and only when dev mode is enabled).
 * Real accounts are reported as unsupported rather than being faked.
 */
export async function syncInbox(workspaceId: string): Promise<SyncSummary> {
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId, status: "CONNECTED" },
    select: {
      id: true,
      platform: true,
      scopes: true,
      name: true,
      username: true,
      token: { select: { encryptedRefreshToken: true } },
    },
  });

  const devMode = isDevMode();
  const now = new Date();
  let fetchedConversations = 0;
  let fetchedMessages = 0;
  const unsupported: SyncSummary["unsupported"] = [];

  for (const account of accounts) {
    const probe = describeInboxSupport({
      id: account.id,
      platform: account.platform,
      scopes: account.scopes ?? [],
      providerName: account.name,
      providerUsername: account.username,
    });

    if (!probe.supported) {
      unsupported.push({
        accountId: account.id,
        platform: account.platform,
        reason: probe.reason ?? "Unsupported.",
      });
      continue;
    }

    let messages: ReturnType<typeof devInboundForAccount> = [];
    if (devMode && hasDevScope(account.scopes ?? [])) {
      messages = devInboundForAccount({
        id: account.id,
        platform: account.platform,
        scopes: account.scopes ?? [],
        providerName: account.name,
        providerUsername: account.username,
      }, now);
    }

    for (const msg of messages) {
      const conversation = await prisma.conversation.upsert({
        where: {
          workspaceId_platform_platformConversationId: {
            workspaceId,
            platform: account.platform,
            platformConversationId: msg.conversationId,
          },
        },
        update: {
          contactName: msg.contactName,
          contactUsername: msg.contactUsername,
          contactAvatarUrl: msg.contactAvatarUrl,
          socialAccountId: account.id,
          lastMessageAt: msg.sentAt,
        },
        create: {
          workspaceId,
          platform: account.platform,
          platformConversationId: msg.conversationId,
          contactName: msg.contactName,
          contactUsername: msg.contactUsername,
          contactAvatarUrl: msg.contactAvatarUrl,
          socialAccountId: account.id,
          lastMessageAt: msg.sentAt,
          status: "OPEN",
        },
      });

      const inserted = await prisma.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            direction: "INBOUND",
            content: msg.content,
            externalId: msg.messageId,
            readAt: null,
            sentAt: msg.sentAt,
          },
        ],
        skipDuplicates: true,
      });
      if (inserted.count > 0) {
        fetchedConversations += 1;
        fetchedMessages += 1;
      }
    }
  }

  return {
    fetchedConversations,
    fetchedMessages,
    unsupported,
    devMode,
  };
}