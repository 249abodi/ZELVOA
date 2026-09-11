import type { Platform } from "@/lib/integrations/types";

export interface InboundMessageInput {
  platform: Platform;
  platformConversationId: string;
  contactName: string;
  contactUsername: string | null;
  contactAvatarUrl: string | null;
  content: string;
  externalMessageId: string;
  sentAt: Date;
}

export interface InboxSourceResult {
  accountId: string;
  platform: Platform;
  supported: boolean;
  reason: string | null;
  messages: InboundMessageInput[];
}

export interface InboxAccount {
  id: string;
  platform: Platform;
  scopes: string[];
  providerName: string | null;
  providerUsername: string | null;
}

const SCRIPT = [
  "Hey! I saw your last post about content scheduling — do you offer a plan for smaller teams?",
  "Thanks for the quick reply last time. Do you have a demo I could try before committing?",
  "That video you shared was spot on. Could you share more resources like it?",
  "I'd love to talk about a partnership. Who handles that on your side?",
  "Is there an option to cancel anytime, or is it annual only?",
  "The dashboard looks great, but I didn't find export options in the trial.",
];

/**
 * Development-only inbound source. It ONLY fires when the connected account is
 * explicitly marked as a dev provider. It produces a small, deterministic
 * scripted conversation so the inbox workflow can be exercised during
 * development. It never imitates a real platform result in production.
 */
export function devInboundForAccount(account: InboxAccount, now: Date): InboxMessage[] {
  if (!hasDevScope(account.scopes)) return [];
  const hourBucket = Math.floor(now.getTime() / (60 * 60 * 1000)) % SCRIPT.length;
  const slot = Math.floor(now.getTime() / (3 * 24 * 60 * 60 * 1000)) % 3;
  const line = SCRIPT[(hourBucket + slot) % SCRIPT.length];
  const conversationId = `dev-${account.id}`;
  return [
    {
      conversationId,
      messageId: `dev-${conversationId}-${now.getTime()}`,
      contactName: `Dev Visitor ${slot + 1}`,
      contactUsername: `dev_visitor_${slot + 1}`,
      contactAvatarUrl: null,
      platform: account.platform,
      content: line,
      sentAt: new Date(now.getTime() - (60 + slot * 45) * 60 * 1000),
    },
  ];
}

export interface InboxMessage {
  conversationId: string;
  messageId: string;
  contactName: string;
  contactUsername: string | null;
  contactAvatarUrl: string | null;
  platform: Platform;
  content: string;
  sentAt: Date;
}

export function hasDevScope(scopes: string[]): boolean {
  return scopes.includes("zelvoa:dev");
}

export function describeInboxSupport(account: InboxAccount): {
  supported: boolean;
  reason: string | null;
} {
  if (hasDevScope(account.scopes)) {
    return { supported: true, reason: null };
  }
  if (account.scopes.some((s) => s === "zelvoa:inbox-import")) {
    return { supported: true, reason: "Connected via inbox import scope." };
  }
  return {
    supported: false,
    reason:
      "Inbound messaging is not connected for this account yet. Add an account with inbox access or use a development account to preview the workflow.",
  };
}