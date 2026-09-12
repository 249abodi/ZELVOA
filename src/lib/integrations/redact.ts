const TOKEN_LIKE =
  /(?:(?:access_token|refresh_token|client_secret|code|dev_token|publishable_key|secret)=\s*['"]?)([A-Za-z0-9._~+/=-]{6,})/gi;

const BEARERS =
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

const HEX_OR_BASE64_LONG =
  /\b[0-9a-zA-Z+/_-]{32,}\b/g;

const DEV_TOKENS =
  /\bdev-(?:access|refresh)-[A-Za-z0-9_-]{12,}\b/g;

export function redactText(input: string, marker = "***"): string {
  if (!input) return input;
  let out = input
    .replace(TOKEN_LIKE, (_m, _v) => {
      const prefix = _m.startsWith("access") ? "access_token=" : "token=";
      return prefix + marker;
    })
    .replace(BEARERS, `Bearer ${marker}`)
    .replace(DEV_TOKENS, `${marker}`);
  out = out.replace(HEX_OR_BASE64_LONG, marker);
  return out;
}

export function redactUrl(url: string, marker = "***"): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((_value, key) => {
      if (/token|secret|code|dev_token/i.test(key)) {
        parsed.searchParams.set(key, marker);
      }
    });
    return redactText(parsed.toString(), marker);
  } catch {
    return redactText(url, marker);
  }
}

export function redactError(error: unknown, marker = "***"): string {
  if (error instanceof Error) {
    return redactText(error.message, marker);
  }
  return redactText(String(error), marker);
}