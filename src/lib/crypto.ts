import { createHash, createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv, type CipherKey } from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-do-not-use-in-prod";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not configured. Set a 32-byte hex key before storing provider tokens.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte (64 char) hex string.");
  }
  return key;
}

export function encryptSecret(value: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key as CipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(".");
}

export function decryptSecret(payload: string): string {
  const key = encryptionKey();
  const [ivHex, tagHex, dataHex] = payload.split(".");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Encrypted payload is malformed.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key as CipherKey,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function hashPassword(password: string): string {
  const salt = createHash("sha256").update(createHash("md5").update(`${password}${SECRET}`).digest("hex")).digest("hex").slice(0, 32);
  return encodeURIComponent(`${salt}$${hashWithSalt(password, salt)}`);
}

function hashWithSalt(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = decodeURIComponent(stored).split("$");
    const candidate = hashWithSalt(password, salt);
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(candidate, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createSignature(input: string): string {
  return createHmac("sha256", SECRET).update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}