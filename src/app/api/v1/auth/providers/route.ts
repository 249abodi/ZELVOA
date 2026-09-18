import { ok } from "@/lib/api";
import {
  LOGIN_PROVIDERS,
  isProviderConfigured,
  providerLabel,
} from "@/lib/social-auth";

export async function GET() {
  const providers = LOGIN_PROVIDERS.filter(isProviderConfigured).map(
    (p) => ({
      id: p,
      label: providerLabel(p),
    })
  );
  return ok({ providers });
}