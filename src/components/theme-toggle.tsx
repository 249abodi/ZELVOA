"use client";

import { Icon } from "@/components/icons";
import { useTheme } from "@/components/theme-provider";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const icon = theme === "dark" ? "moon" : theme === "light" ? "sun" : "system";

  return (
    <Dropdown
      width="w-48"
      trigger={
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Toggle theme">
          <Icon name={icon} size={18} />
        </Button>
      }
    >
      <DropdownLabel>Theme</DropdownLabel>
      <DropdownItem
        icon="sun"
        label="Light"
        onClick={() => setTheme("light")}
      />
      <DropdownItem icon="moon" label="Dark" onClick={() => setTheme("dark")} />
      <DropdownSeparator />
      <DropdownItem icon="system" label="System" onClick={() => setTheme("system")} />
    </Dropdown>
  );
}