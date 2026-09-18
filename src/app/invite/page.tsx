import Link from "next/link";
import type { Metadata } from "next";
import { ZelvoaLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { InviteAcceptance } from "@/components/invites/invite-acceptance";

export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <Link href="/" className="mb-8 flex items-center justify-center">
          <ZelvoaLogo variant="full" size={36} />
        </Link>
        <div className="w-full max-w-md text-center text-sm text-muted-foreground">
          This invitation link is missing its token. Ask the sender to share a fresh link.
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-8 flex items-center justify-center">
        <ZelvoaLogo variant="full" size={36} />
      </Link>
      <div className="w-full max-w-md">
        <InviteAcceptance token={token} />
      </div>
    </div>
  );
}