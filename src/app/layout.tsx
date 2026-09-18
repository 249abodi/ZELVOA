import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_DIR,
  isLocale,
} from "@/lib/i18n";

const APP_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "ZELVOA — Create. Schedule. Grow.",
    template: "%s — ZELVOA",
  },
  applicationName: "ZELVOA",
  description:
    "Social media management in one place. Create, schedule, and grow with ZELVOA.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ZELVOA",
    title: "ZELVOA — Create. Schedule. Grow.",
    description:
      "Social media management in one place. Create, schedule, and grow.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZELVOA — Create. Schedule. Grow.",
    description:
      "Social media management in one place. Create, schedule, and grow.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  return (
    <html lang={locale} dir={LOCALE_DIR[locale]} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}