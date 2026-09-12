export function buildSecurityHeaders(opts: { production?: boolean } = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-XSS-Protection": "0",
  };
  if (opts.production !== false) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}

export function buildCspHeader(nonce: string): string {
  const parts = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:" + buildAllowlist("IMG_CSP_ALLOW"),
    `connect-src 'self' ${buildAllowlist("CONNECT_CSP_ALLOW")}`,
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return parts.filter((p) => p.length > 0).join("; ");
}

export function cspEnabled(): boolean {
  return process.env.ENABLE_CSP === "true";
}

function buildAllowlist(envName: string): string {
  const raw = process.env[envName] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("https://"))
    .map((u) => ` ${u}`)
    .join("");
}