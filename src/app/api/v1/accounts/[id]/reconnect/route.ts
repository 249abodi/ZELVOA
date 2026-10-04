import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, forbidden, notFound, ok, parseJson } from "@/lib/api";
import { reconnectAccountSchema } from "@/lib/validators";
import { getProvider } from "@/lib/integrations/factory";
import { getRegistryEntry, getPlatformBaseUrl } from "@/lib/integrations/registry";
import { encryptSecret, generateOAuthCodeVerifier, generateOAuthState } from "@/lib/crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to manage social accounts.");
    }

    const raw = await parseJson(request);
    const body = reconnectAccountSchema.parse(raw);

    const account = await prisma.socialAccount.findFirst({
      where: { id, workspaceId: context.workspace.id },
    });
    if (!account) return notFound("Social account not found.");

    const entry = getRegistryEntry(account.platform);
    if (!entry.configured && !entry.devMode) {
      return ok(
        { status: "not_configured", canConnect: false, message: entry.reason },
        { status: 200 }
      );
    }

    const state = generateOAuthState();
    const codeVerifier = account.platform === "X" ? generateOAuthCodeVerifier() : undefined;
    const redirectUri =
      body.redirectUri ??
      `${getPlatformBaseUrl(new URL(request.url).origin)}/api/v1/accounts/oauth/callback`;

    await prisma.oAuthState.create({
      data: {
        organizationId: context.organization?.id ?? "",
        workspaceId: context.workspace.id,
        platform: account.platform,
        state,
        redirectUri,
        encryptedCodeVerifier: codeVerifier ? encryptSecret(codeVerifier) : null,
        connectsTo: id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        ipAddress: request.headers.get("x-forwarded-for") ?? null,
      },
    });

    const provider = getProvider(account.platform);
    const authorizationUrl = provider.buildAuthorizationUrl({ state, redirectUri, codeVerifier });

    return ok({
      status: "ready",
      canConnect: true,
      authorizationUrl,
      state,
      isDev: entry.devMode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
