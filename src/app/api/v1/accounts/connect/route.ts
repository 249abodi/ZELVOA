import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { handleApiError, fail, unauthorized, forbidden, ok, parseJson } from "@/lib/api";
import { connectAccountSchema } from "@/lib/validators";
import { getProvider } from "@/lib/integrations/factory";
import { getRegistryEntry, getPlatformBaseUrl } from "@/lib/integrations/registry";
import { encryptSecret, generateOAuthCodeVerifier, generateOAuthState } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const context = await getCurrentContext();
    if (!context) return unauthorized();
    if (!context.workspace) return fail("No workspace selected.", 400);
    if (!can(context.role, "accounts.manage")) {
      return forbidden("You do not have permission to connect social accounts.");
    }

    const raw = await parseJson(request);
    const body = connectAccountSchema.parse(raw);

    const entry = getRegistryEntry(body.platform);
    if (!entry.configured && !entry.devMode) {
      return ok(
        {
          status: "not_configured",
          canConnect: false,
          message: entry.reason,
        },
        { status: 200 }
      );
    }

    const state = generateOAuthState();
    const codeVerifier = body.platform === "X" ? generateOAuthCodeVerifier() : undefined;
    const redirectUri =
      body.redirectUri ??
      `${getPlatformBaseUrl(new URL(request.url).origin)}/api/v1/accounts/oauth/callback`;

    const ttlMinutes = 10;
    await prisma.oAuthState.create({
      data: {
        organizationId: context.organization?.id ?? "",
        workspaceId: context.workspace.id,
        platform: body.platform,
        state,
        redirectUri,
        encryptedCodeVerifier: codeVerifier ? encryptSecret(codeVerifier) : null,
        connectsTo: body.connectsTo ?? null,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        ipAddress: request.headers.get("x-forwarded-for") ?? null,
      },
    });

    const provider = getProvider(body.platform);
    let authorizationUrl: string;
    try {
      authorizationUrl = provider.buildAuthorizationUrl({ state, redirectUri, codeVerifier });
    } catch {
      await prisma.oAuthState.delete({ where: { state } });
      return fail("Provider could not generate an authorization URL.", 500);
    }

    await writeAudit({
      organizationId: context.organization?.id,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "account.connect_initiated",
      entityType: "SocialAccount",
      entityId: body.connectsTo,
      metadata: { platform: body.platform },
    });

    return ok({
      status: "ready",
      canConnect: true,
      authorizationUrl,
      state,
      isDev: entry.devMode,
      message: entry.devMode
        ? "Development provider. Connecting will create a clearly-labelled development account."
        : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
