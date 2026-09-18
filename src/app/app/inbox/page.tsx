import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import InboxPageClient from "@/components/inbox/inbox-page";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const context = await getCurrentContext();
  const canReply = can(context?.role, "inbox.reply");
  const canAssign = can(context?.role, "inbox.assign");
  return <InboxPageClient canReply={canReply} canAssign={canAssign} />;
}