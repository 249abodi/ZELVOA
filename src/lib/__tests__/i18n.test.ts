import { describe, expect, test } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_DIR,
  getDictionary,
  isLocale,
} from "@/lib/i18n";

describe("i18n config", () => {
  test("accepts only supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  test("defaults to English and maps dir correctly", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_DIR.en).toBe("ltr");
    expect(LOCALE_DIR.ar).toBe("rtl");
  });

  test("both dictionaries contain the same keys", () => {
    const en = getDictionary("en");
    const ar = getDictionary("ar");
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  test("Arabic dictionary translates shell labels", () => {
    const ar = getDictionary("ar");
    expect(ar["nav.dashboard"]).not.toBe("Dashboard");
    expect(ar["header.logout"]).toBe("تسجيل الخروج");
  });
});