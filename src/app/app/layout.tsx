import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { getDictionary } from "@/lib/i18n";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { Notifications } from "@/components/app/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getCurrentContext();
  if (!context) redirect("/login");

  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="min-h-screen bg-background-subtle">
      <Sidebar
        dict={dict}
        organizationName={context.organization?.name ?? "Workspace"}
        role={context.role}
      />
      <div className="lg:ps-60">
        <Header
          dict={dict}
          locale={locale}
          userName={context.user.name}
          userEmail={context.user.email}
          workspaceName={context.workspace?.name ?? context.organization?.name ?? "Workspace"}
        />
        <Notifications />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}