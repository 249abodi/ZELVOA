import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Icon } from "@/components/icons";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatNumber, cn } from "@/lib/utils";
import { format, isTomorrow } from "date-fns";

export const metadata = { title: "Dashboard" };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const workspaceId = context.workspace?.id;
  if (!workspaceId) {
    return (
      <EmptyState
        icon="workspace"
        title="No workspace yet"
        description="Create a workspace to start managing your social channels."
        actionLabel="Create workspace"
      />
    );
  }

  const now = new Date();

  const [postCount, scheduledPosts, socialAccounts, publishedCount, approvalCount] =
    await Promise.all([
      prisma.post.count({ where: { workspaceId, deletedAt: null } }),
      prisma.scheduledPost.findMany({
        where: {
          workspaceId,
          scheduledFor: { gte: now },
          status: { in: ["PENDING", "QUEUED"] },
        },
        include: {
          post: {
            select: { id: true, title: true, content: true, postType: true },
          },
          socialAccount: { select: { platform: true } },
        },
        orderBy: { scheduledFor: "asc" },
        take: 8,
      }),
      prisma.socialAccount.count({ where: { workspaceId } }),
      prisma.post.count({
        where: { workspaceId, status: "PUBLISHED", deletedAt: null },
      }),
      prisma.approval.count({
        where: {
          workspaceId,
          status: "PENDING",
          post: { deletedAt: null },
        },
      }),
    ]);

  const hasAccounts = socialAccounts > 0;
  const hasPosts = postCount > 0;

  return (
    <div className="grid gap-8">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}
        </h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Analytics cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="create"
          label="Posts"
          value={formatNumber(postCount)}
          hint={
            hasPosts
              ? `${formatNumber(publishedCount)} published`
              : "No posts yet"
          }
        />
        <StatCard
          icon="trend-up"
          label="Reach"
          value="—"
          hint={hasAccounts ? "Sync upcoming" : "Connect accounts"}
        />
        <StatCard
          icon="campaigns"
          label="Engagement"
          value="—"
          hint={hasAccounts ? "Sync upcoming" : "Connect accounts"}
        />
        <StatCard
          icon="accounts"
          label="Followers"
          value="—"
          hint={hasAccounts ? `${socialAccounts} connected` : "Connect accounts"}
        />
      </div>

      {/* Approval notice */}
      {approvalCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
          <Icon name="approvals" size={18} className="text-warning" />
          <p className="text-sm">
            <span className="font-medium">{approvalCount}</span>{" "}
            {approvalCount === 1 ? "post" : "posts"} awaiting approval.{" "}
            <Link
              href="/app/approvals"
              className="font-medium underline underline-offset-2"
            >
              Review now
            </Link>
          </p>
        </div>
      )}

      {/* Upcoming posts */}
      <section className="grid gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming Posts</h2>
          <Link
            href="/app/calendar"
            className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            View calendar
          </Link>
        </div>

        {scheduledPosts.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={hasAccounts ? "Nothing scheduled yet" : "Connect your first social account"}
            description={
              hasAccounts
                ? "Plan your first post and schedule it across your channels."
                : "Connect your first social account to start managing your content."
            }
            actionLabel={hasAccounts ? "Create Post" : "Connect Account"}
            actionHref={hasAccounts ? "/app/posts/create" : "/app/accounts/select"}
            actionIcon={hasAccounts ? "create" : "accounts"}
          />
        ) : (
          <div className="grid gap-3">
            {scheduledPosts.map((p) => (
              <UpcomingRow
                key={p.id}
                platform={p.socialAccount?.platform ?? null}
                title={p.post.title ?? p.post.content.slice(0, 80)}
                scheduledFor={p.scheduledFor}
                postType={p.post.postType}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-3">
        <QuickAction
          href="/app/posts/create"
          icon="create"
          title="Create a post"
          description="Draft content for one or more platforms."
        />
        <QuickAction
          href="/app/media"
          icon="media"
          title="Upload media"
          description="Build your media library for reuse."
        />
        <QuickAction
          href="/app/ai"
          icon="sparkles"
          title="Ask the AI assistant"
          description="Generate captions, hashtags, and ideas."
        />
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: "create" | "trend-up" | "campaigns" | "accounts";
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary dark:bg-primary-900/30">
          <Icon name={icon} size={16} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function UpcomingRow({
  platform,
  title,
  scheduledFor,
  postType,
}: {
  platform: string | null;
  title: string;
  scheduledFor: Date;
  postType: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon name="calendar-dot" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {platform ? <PlatformBadge platform={platform} /> : (
              <Badge variant="secondary">Multiple platforms</Badge>
            )}
            <Badge variant="outline">{postType}</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            {format(scheduledFor, "h:mm a")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isTomorrow(scheduledFor)
              ? "Tomorrow"
              : format(scheduledFor, "EEE, MMM d")}
          </p>
        </div>
        <Link
          href={`/app/calendar`}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="View on calendar"
        >
          <Icon name="chevron-right" size={16} />
        </Link>
      </CardContent>
    </Card>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const styles: Record<string, { cls: string; icon: string; label: string }> = {
    INSTAGRAM: {
      cls: "bg-accent-100 text-accent-600 dark:bg-accent-600/30 dark:text-accent-300",
      icon: "instagram",
      label: "Instagram",
    },
    FACEBOOK: {
      cls: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300",
      icon: "facebook",
      label: "Facebook",
    },
    TIKTOK: {
      cls: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
      icon: "tiktok",
      label: "TikTok",
    },
    LINKEDIN: {
      cls: "bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300",
      icon: "linkedin",
      label: "LinkedIn",
    },
    X: {
      cls: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
      icon: "xtwitter",
      label: "X",
    },
  };
  const s = styles[platform] ?? styles.INSTAGRAM;

  return (
    <Badge variant="outline" className={cn(s.cls, "border-0")}>
      <Icon name={s.icon as never} size={12} />
      {s.label}
    </Badge>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: "create" | "media" | "sparkles";
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:border-ring/40 hover:shadow-md"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:bg-primary-900/30">
        <Icon name={icon} size={18} />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}