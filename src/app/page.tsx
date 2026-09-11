import Link from "next/link";
import { LogoMark, Icon } from "@/components/icons";
import { SiteNav } from "@/components/site/nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: "calendar" as const,
    title: "Content calendar",
    description:
      "Plan every post across Instagram, Facebook, TikTok, LinkedIn, and X from one visual calendar.",
  },
  {
    icon: "sparkles" as const,
    title: "AI content assistant",
    description:
      "Generate captions, hashtags, and post variations in your brand tone in seconds.",
  },
  {
    icon: "analytics" as const,
    title: "Analytics that matter",
    description:
      "Track reach, engagement, and followers across platforms with clear, honest metrics.",
  },
  {
    icon: "team" as const,
    title: "Team collaboration",
    description:
      "Roles, approvals, and audit trails — keep your content pipeline under control.",
  },
  {
    icon: "inbox" as const,
    title: "Unified inbox",
    description:
      "Reply to messages from every platform in a single conversation view.",
  },
  {
    icon: "campaigns" as const,
    title: "Campaigns",
    description:
      "Organize posts, goals, and reporting into structured campaigns with a clear timeline.",
  },
];

const pricing = [
  {
    name: "Free",
    price: "RM 0",
    period: "forever",
    description: "Get started with one account and ten posts a month.",
    features: ["1 social account", "10 posts/month", "Basic analytics"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Starter",
    price: "RM 29",
    period: "per month",
    description: "For growing creators and small teams.",
    features: [
      "5 social accounts",
      "100 posts/month",
      "Analytics",
      "Scheduling",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Business",
    price: "RM 79",
    period: "per month",
    description: "For businesses managing multiple channels.",
    features: [
      "15 social accounts",
      "Advanced scheduling",
      "AI Assistant",
      "Team members",
      "Approval workflow",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: "RM 199",
    period: "per month",
    description: "For agencies managing many clients.",
    features: [
      "Multiple clients",
      "Multiple workspaces",
      "Advanced team management",
      "Advanced analytics",
      "White-label capabilities",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Which platforms does ZELVOA support?",
    a: "ZELVOA is designed for Instagram, Facebook, TikTok, LinkedIn, and X. Each integration is built as a clean provider abstraction, with unsupported capabilities clearly marked.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. ZELVOA runs entirely in your browser. Connect your social accounts securely with OAuth — we never store provider passwords.",
  },
  {
    q: "Can my team approve content before it goes live?",
    a: "Yes. The approval workflow lets teams move posts from draft through review to scheduling with full audit records.",
  },
  {
    q: "What happens to my posts if an integration is unavailable?",
    a: "ZELVOA never fakes publishing. Pending jobs are queued and retried safely, and you are notified — integration availability is always clear in the UI.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(124,99,247,0.18),transparent_60%)]"
        />
        <div className="mx-auto max-w-6xl px-4 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
          <Badge variant="secondary" className="mb-6">
            <Icon name="zap" size={14} />
            One workspace. Every social channel.
          </Badge>
          <h1 className="text-balance text-display font-bold tracking-tight">
            Create. Schedule. Grow.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground">
            All your social, one place. Create, manage, schedule, analyze, and
            grow your social presence across every platform — without opening
            them one by one.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-700"
            >
              Start Free
              <Icon name="arrow-up" size={15} className="rotate-45" />
            </Link>
            <Link
              href="#features"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-card px-6 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
            >
              See How It Works
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free forever plan · No credit card required
          </p>

          {/* Dashboard preview */}
          <div className="mt-16 text-left">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── Logos strip ──────────────────────────────── */}
      <section className="border-y border-border bg-background-subtle">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-8 text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2"><Icon name="instagram" size={18} />Instagram</span>
          <span className="flex items-center gap-2"><Icon name="facebook" size={18} />Facebook</span>
          <span className="flex items-center gap-2"><Icon name="tiktok" size={18} />TikTok</span>
          <span className="flex items-center gap-2"><Icon name="linkedin" size={18} />LinkedIn</span>
          <span className="flex items-center gap-2"><Icon name="xtwitter" size={18} />X</span>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything your social team needs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            ZELVOA is the workspace where businesses create, manage, schedule,
            analyze, and grow their social presence.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary dark:bg-primary-900/30">
                  <Icon name={f.icon} size={22} />
                </div>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────── */}
      <section id="pricing" className="border-t border-border bg-background-subtle py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple pricing that scales with you
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Upgrade when your team grows.
            </p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-4">
            {pricing.map((p) => (
              <Card
                key={p.name}
                className={`flex flex-col ${p.highlight ? "border-primary shadow-md ring-1 ring-primary/30" : ""}`}
              >
                <CardHeader>
                  {p.highlight && (
                    <Badge variant="default" className="mb-1 w-fit">
                      Most popular
                    </Badge>
                  )}
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{p.price}</span>
                    <span className="text-xs text-muted-foreground">{p.period}</span>
                  </div>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="grid gap-2.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Icon name="check" size={15} className="text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      p.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary-700"
                        : "border border-border-strong bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Frequently asked questions
        </h2>
        <div className="mt-10 grid gap-4">
          {faqs.map((f) => (
            <Card key={f.q}>
              <CardHeader>
                <CardTitle className="text-base">{f.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────── */}
      <section className="border-t border-border bg-background-subtle">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to grow your social presence?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            All your social, one place. Start free today.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-700"
          >
            Start Free
            <Icon name="arrow-up" size={15} className="rotate-45" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="font-bold tracking-tight">ZELVOA</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Create. Schedule. Grow.
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ZELVOA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b border-border bg-background-subtle px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-destructive/70" />
        <span className="h-3 w-3 rounded-full bg-warning/70" />
        <span className="h-3 w-3 rounded-full bg-success/70" />
        <span className="ml-3 flex h-6 w-6 items-center justify-center rounded-md bg-primary text-white">
          <span className="text-xs font-bold">Z</span>
        </span>
        <div className="ml-2 h-4 w-44 rounded bg-muted" />
      </div>
      <div className="flex">
        <div className="hidden w-48 shrink-0 gap-2 border-r border-border p-4 sm:block">
          {[
            "dashboard",
            "calendar",
            "create",
            "sparkles",
            "media",
            "inbox",
            "analytics",
          ].map((ic) => (
            <div
              key={ic}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground"
            >
              <Icon name={ic as never} size={15} />
              <span className="h-3 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="flex-1 gap-4 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {["Posts", "Reach", "Engagement", "Followers"].map((label, i) => (
              <div key={label} className="rounded-xl border border-border p-4">
                <div className="h-3 w-14 rounded bg-muted text-[10px] font-medium text-muted-foreground">
                  {label}
                </div>
                <div className="mt-2 h-5 w-16 rounded bg-muted" />
                {i === 1 && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-success">
                    <Icon name="trend-up" size={11} /> 12.4%
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="flex gap-1">
                {["Instagram", "Facebook", "TikTok"].map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] text-primary"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-end gap-2">
              {[40, 65, 45, 80, 60, 90, 70].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="h-16 w-full rounded-t-md bg-gradient-to-t from-primary/30 to-primary/80"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}