import jwt from "jsonwebtoken";
import { requireAuthSecret } from "@/lib/auth-secret";

export interface SessionPayload {
  sub: string;
  org?: string;
  ws?: string;
  role?: string;
}

export const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export async function signSession(payload: SessionPayload): Promise<string> {
  return jwt.sign(
    {
      org: payload.org,
      ws: payload.ws,
      role: payload.role,
    },
    requireAuthSecret(),
    { subject: payload.sub, expiresIn: `${TTL_DAYS}d` }
  );
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const decoded = jwt.verify(token, requireAuthSecret());
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