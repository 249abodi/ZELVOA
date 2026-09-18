"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dropdown,
  DropdownItem,
} from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import {
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  isLocale,
  type Locale,
} from "@/lib/i18n";

export function LocaleSwitcher({
  locale,
  align = "end",
}: {
  locale?: Locale;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Locale>(locale ?? DEFAULT_LOCALE);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const lang = document.documentElement.lang;
      if (isLocale(lang)) setCurrent(lang);
    });
  }, []);

  const select = async (next: Locale) => {
    if (next === current) return;
    try {
      const res = await fetch("/api/v1/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) return;
    } catch {
      return;
    }
    router.refresh();
  };

  return (
    <Dropdown
      width="w-40"
      trigger={
        <Button variant="ghost" size="icon" aria-label={LOCALE_NAMES[current]}>
          <Icon name="globe" size={18} />
        </Button>
      }
      align={align}
    >
      <DropdownItem
        icon={current === "en" ? "check" : "globe"}
        label="English"
        onClick={() => select("en")}
      />
      <DropdownItem
        icon={current === "ar" ? "check" : "globe"}
        label="العربية"
        onClick={() => select("ar")}
      />
    </Dropdown>
  );
}