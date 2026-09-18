export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "zelvoa_locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function defineDicts<E extends Record<string, string>>(
  en: E,
  ar: { [K in keyof E]: string }
): { en: E; ar: { [K in keyof E]: string } } {
  return { en, ar };
}

const { en, ar } = defineDicts(
  {
    "app.manage": "Manage",
    "app.workspace": "Workspace",
    "app.platform": "Platform",
    "nav.dashboard": "Dashboard",
    "nav.calendar": "Content Calendar",
    "nav.create": "Create Post",
    "nav.ai": "AI Assistant",
    "nav.media": "Media Library",
    "nav.inbox": "Inbox",
    "nav.analytics": "Analytics",
    "nav.campaigns": "Campaigns",
    "nav.team": "Team",
    "nav.approvals": "Approvals",
    "nav.accounts": "Social Accounts",
    "nav.billing": "Billing",
    "nav.settings": "Settings",
    "nav.admin": "Admin Console",
    "header.account": "Account",
    "header.profile": "Profile",
    "header.settings": "Settings",
    "header.logout": "Log out",
    "header.loggedOut": "Logged out",
    "menu.open": "Open menu",
    "menu.close": "Close menu",
  },
  {
    "app.manage": "الإدارة",
    "app.workspace": "مساحة العمل",
    "app.platform": "المنصة",
    "nav.dashboard": "لوحة التحكم",
    "nav.calendar": "التقويم",
    "nav.create": "إنشاء منشور",
    "nav.ai": "المساعد الذكي",
    "nav.media": "مكتبة الوسائط",
    "nav.inbox": "صندوق الوارد",
    "nav.analytics": "التحليلات",
    "nav.campaigns": "الحملات",
    "nav.team": "الفريق",
    "nav.approvals": "الموافقات",
    "nav.accounts": "حسابات التواصل",
    "nav.billing": "الفواتير",
    "nav.settings": "الإعدادات",
    "nav.admin": "لوحة الإدارة",
    "header.account": "الحساب",
    "header.profile": "الملف الشخصي",
    "header.settings": "الإعدادات",
    "header.logout": "تسجيل الخروج",
    "header.loggedOut": "تم تسجيل الخروج",
    "menu.open": "فتح القائمة",
    "menu.close": "إغلاق القائمة",
  }
);

export type Dict = typeof en;

export function getDictionary(locale: Locale): Dict {
  return locale === "ar" ? ar : en;
}