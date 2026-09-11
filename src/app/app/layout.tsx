import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
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

  return (
    <div className="min-h-screen bg-background-subtle">
      <Sidebar
        organizationName={context.organization?.name ?? "Workspace"}
        role={context.role}
      />
      <div className="lg:pl-60">
        <Header
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