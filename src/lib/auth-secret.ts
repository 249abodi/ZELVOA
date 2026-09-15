export function requireAuthSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not configured.");
  }
  return "dev-secret-do-not-use-in-prod";
}