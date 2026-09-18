export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = process.env.ADMIN_EMAILS ?? "";
  if (allowlist === "") return false;
  return allowlist
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase());
}

export function adminDisabled(): boolean {
  return process.env.DISABLE_ADMIN === "true";
}

export function canAccessAdmin(input: {
  email?: string | null;
  role?: string | null;
}): boolean {
  if (adminDisabled()) return false;
  if (input.email && isAdminEmail(input.email)) return true;
  return false;
}