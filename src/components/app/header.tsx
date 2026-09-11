"use client";

import { useRouter } from "next/navigation";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { MobileNav } from "@/components/app/mobile-nav";

export function Header({
  userName,
  userEmail,
  workspaceName,
}: {
  userName: string;
  userEmail: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const { toastSuccess } = useToast();

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    toastSuccess("Logged out");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <MobileNav />
      </div>

      <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
        <Icon name="workspace" size={16} />
        <span className="font-medium text-foreground">{workspaceName}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative text-muted-foreground"
        >
          <Icon name="bell" size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        <Dropdown
          width="w-64"
          trigger={
            <button className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-muted">
              <Avatar name={userName} size="sm" />
              <span className="hidden text-left sm:block">
                <span className="block max-w-[160px] truncate text-sm font-medium">
                  {userName}
                </span>
                <span className="block max-w-[160px] truncate text-xs text-muted-foreground">
                  {userEmail}
                </span>
              </span>
              <Icon name="chevron-down" size={14} className="text-muted-foreground" />
            </button>
          }
        >
          <DropdownLabel>Account</DropdownLabel>
          <DropdownItem
            icon="user"
            label="Profile"
            onClick={() => router.push("/app/settings")}
          />
          <DropdownItem
            icon="settings"
            label="Settings"
            onClick={() => router.push("/app/settings")}
          />
          <DropdownSeparator />
          <DropdownItem icon="logout" label="Log out" onClick={logout} danger />
        </Dropdown>
      </div>
    </header>
  );
}