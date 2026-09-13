import jwt from "jsonwebtoken";

export interface SessionPayload {
  sub: string;
  org?: string;
  ws?: string;
  role?: string;
}

function requireSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not configured.");
  }
  return "dev-secret-do-not-use-in-prod";
}

export const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export async function signSession(payload: SessionPayload): Promise<string> {
  return jwt.sign(
    {
      org: payload.org,
      ws: payload.ws,
      role: payload.role,
    },
    requireSecret(),
    { subject: payload.sub, expiresIn: `${TTL_DAYS}d` }
  );
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const decoded = jwt.verify(token, requireSecret());
    if (typeof decoded === "string") return null;
    return {
      sub: decoded.sub ?? "",
      org: decoded.org as string | undefined,
      ws: decoded.ws as string | undefined,
      role: decoded.role as string | undefined,
    };
  } catch {
    return null;
  }
}