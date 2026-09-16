import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, unauthorized, ok, forbidden } from "@/lib/api";
import { listProviderEntries, areDevProvidersAllowed, isProduction } from "@/lib/integrations/registry";
import { PLATFORM_META, serializeCapabilities } from "@/lib/integrations/platforms";

export async function GET() {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!can(context.role, "accounts.view")) {
      return forbidden("You do not have permission to view social accounts.");
    }

    return ok({
      devProvidersAllowed: areDevProvidersAllowed(),
      isProduction: isProduction(),
      providers: listProviderEntries().map((entry) => ({
        platform: entry.platform,
        configured: entry.configured,
        devMode: entry.devMode,
        reason: entry.reason,
        label: PLATFORM_META[entry.platform].label,
        icon: PLATFORM_META[entry.platform].icon,
        capabilities: serializeCapabilities(PLATFORM_META[entry.platform].capabilities),
        publishingImplemented: PLATFORM_META[entry.platform].publishingImplemented,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}