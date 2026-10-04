import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptSecret, generateOAuthState } from "@/lib/crypto";
import {
  buildAuthorizationUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  isLoginProvider,
  sanitizeNext,
} from "@/lib/social-auth";

const STATE_TTL_MS = 10 * 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: raw } = await params;
  const provider = raw.toUpperCase();
  if (!isLoginProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/v1/auth/oauth/${provider.toLowerCase()}/callback`;
  const state = generateOAuthState();
  const next = sanitizeNext(url.searchParams.get("next"));

  const usesPKCE = provider === "X";
  const codeVerifier = usesPKCE ? generateCodeVerifier() : null;
  const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : undefined;

  const authorizeUrl = buildAuthorizationUrl({
    provider,
    state,
    redirectUri,
    codeChallenge,
  });

  await prisma.authOAuthState.create({
    data: {
      provider,
      state,
      redirectUri,
      ...(codeVerifier ? { codeVerifier: encryptSecret(codeVerifier) } : {}),
      ...(next ? { next } : {}),
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });

  return NextResponse.redirect(authorizeUrl);
}
