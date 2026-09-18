import { cookies } from "next/headers";
import { ok, fail, handleApiError } from "@/lib/api";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { locale?: unknown } | null;
    const locale = body?.locale;
    if (!isLocale(locale)) {
      return fail("invalid payload: locale must be 'en' or 'ar'");
    }
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return ok({ locale });
  } catch (err) {
    return handleApiError(err);
  }
}