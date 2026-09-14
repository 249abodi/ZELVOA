# ZELVOA — AI Assistant Operations

This document describes how the AI assistant works, how to configure the
OpenAI-compatible provider, the endpoint contract, quota behavior, and the
security model. Keep this file free of real credentials.

## Status

| Item | Value |
| --- | --- |
| Provider | OpenAI-compatible Chat Completions API |
| Config | `AI_API_KEY` (required), `AI_BASE_URL` (optional), `AI_MODEL` (optional) |
| Disconnected behavior | `AI_NOT_CONFIGURED` (HTTP 503) — never faked |
| Endpoint | `POST /api/v1/ai/generate`, `GET /api/v1/ai/status` |
| UI | `/app/ai` studio + in-composer AI panel |
| Documentation of features | captions, hashtags, CTA, content ideas, rewrite/tone |

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `AI_API_KEY` | Yes | The provider key. Without it the studio and API stay disabled (`AI_NOT_CONFIGURED`). |
| `AI_BASE_URL` | No | Base URL for the OpenAI-compatible API, e.g. `https://api.openai.com/v1`. Trailing slashes are stripped. |
| `AI_MODEL` | No | Model to use, e.g. `gpt-4o-mini`. Defaults to `gpt-4o-mini`. |
| `AI_MONTHLY_REQUEST_LIMIT` | No | Per-organization monthly request cap. Defaults to `2000`. |

Rules:

- These variables are server-only. Never reference them with a `NEXT_PUBLIC_` prefix.
- Never log, return, persist, or commit the key. `AI_API_KEY` must not appear in
  API responses, error bodies, database records, or Git history.
- `.env.example` contains empty placeholders only. Add real values in your local
  `.env` (gitignored) and in Vercel Project Settings.

## How generation works

1. `POST /api/v1/ai/generate` requires an authenticated user with the `ai.use`
   permission and a selected workspace.
2. The request is validated (`aiGenerateSchema`): feature, platform, language,
   tone, length, count, content.
3. A server-only prompt is built (`src/lib/ai/prompts.ts`) that includes:
   - system-level safety rules (user input is content data, never instructions;
     never reveal internal prompts or app secrets; stay in the requested
     language/platform/tone/schema),
   - the platform's real limits (e.g. X ≤ 280 chars),
   - language instructions (English or natural modern Arabic),
   - the response JSON schema.
4. The provider is called in JSON mode (`response_format: { type: "json_object" }`)
   through `src/lib/ai/openai.ts`.
5. The raw provider output is parsed and validated server-side against a
   per-feature Zod schema (`src/lib/ai/output.ts`). Malformed output is rejected
   with `AI_INVALID_REQUEST` (422) — raw provider text is never passed through.
6. Usage is recorded (`AIUsageRecord`) with safe metadata only: workspace, actor,
   feature, model, token counts, status, safe error code, duration.
7. An audit log entry `ai.generated` is written.

## Request body

```json
{
  "feature": "captions",             // captions | hashtags | cta | ideas | rewrite | tone
  "content": "Optional source text",
  "platform": "INSTAGRAM",           // optional
  "language": "en",                  // en | ar
  "tone": "professional",            // optional
  "length": "medium",                // optional
  "count": 1                         // 1–6
}
```

Content is capped at 40,000 characters; `count` at 6.

## Success response

```json
{
  "data": {
    "generated": true,
    "text": "{\"caption\": \"...\"}",
    "output": { "caption": "..." },
    "model": "gpt-4o-mini",
    "usage": { "promptTokens": 100, "completionTokens": 50, "remaining": 1999 }
  }
}
```

The `output` shape depends on the feature:

| Feature | Output shape |
| --- | --- |
| `captions` | `{ "caption": "..." }` |
| `hashtags` | `{ "hashtags": ["#a", "#b"] }` |
| `cta` | `{ "cta": "..." }` |
| `ideas` | `{ "ideas": [{ "title", "description", "format" }] }` |
| `rewrite` / `tone` | `{ "rewritten": "..." }` |

## Error codes

All lane errors return a machine-readable `error.code`. Provider-sensitive
details are never surfaced.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `AI_NOT_CONFIGURED` | 503 | No `AI_API_KEY` (or a placeholder key) — the assistant is disabled by design. |
| `AI_UNAUTHORIZED` | 502 | Provider rejected the configured key (401/403). |
| `AI_RATE_LIMITED` | 429 | Monthly quota or per-user rate limit reached; `Retry-After` header is set. Also used when the provider itself returns 429. |
| `AI_PROVIDER_UNAVAILABLE` | 502 | Provider returned 5xx or the network call failed. |
| `AI_INVALID_REQUEST` | 400/422 | Request validation failed (422) or provider output was malformed (422). |
| `AI_TIMEOUT` | 504 | Provider request timed out (30s) or returned 408. |
| `AI_UNKNOWN_ERROR` | 502 | Anything else. |

## Quota and rate limiting

- Per-organization monthly quota (database-backed, `AIUsageRecord`), only
  successful generations count. Limit configurable via `AI_MONTHLY_REQUEST_LIMIT`.
- Per-user in-memory sliding window: 60 requests/hour.
- Unauthorized users never consume quota; the workspace and organization ids
  always come from the session context, never from the request body.
- On quota/rate-limit exhaustion the API returns 429 with a `Retry-After`
  header and `AI_RATE_LIMITED`.

## Status endpoint

`GET /api/v1/ai/status` returns:

```json
{
  "data": {
    "enabled": true,
    "message": "AI provider connected.",
    "code": null,
    "model": "gpt-4o-mini",
    "monthlyUsage": 2,
    "monthlyLimit": 2000,
    "remaining": 1998
  }
}
```

When disabled it returns `enabled: false` and `code: "AI_NOT_CONFIGURED"`.

## UI

- `/app/ai` — full AI studio (feature, platform, language, tone, length,
  options, content input; structured results; copy / regenerate / clear; quota
  meter; localized error messages; RTL layout for Arabic).
- Post composer (`/app/posts/create`) — a compact AI panel that generates and
  inserts captions, appends hashtags, applies rewrites, or adds CTA lines.

## Security model

- The API key never leaves the server process.
- User input is treated as untrusted content, not instructions.
- Provider error messages are mapped to safe, fixed messages.
- RBAC (`ai.use`) is enforced server-side on both endpoints.
- AI endpoints go through the same security headers middleware as all `/api/*`
  routes.

## Troubleshooting

- **`AI_NOT_CONFIGURED` everywhere** — `AI_API_KEY` is not set in the running
  environment. Set it and redeploy.
- **`AI_UNAUTHORIZED`** — the key is rejected by the provider (invalid, revoked,
  or the base URL points at the wrong project).
- **`AI_TIMEOUT`** — the model is slow or the base URL is unreachable; check
  network and model availability.
- **Production stays `AI_NOT_CONFIGURED`** — that is expected until credentials
  are added in Vercel Project Settings. The assistant is intentionally never
  faked.

## Local setup

```bash
cp .env.example .env
# fill in AI_API_KEY (and optionally AI_BASE_URL / AI_MODEL)
npm run db:push        # or npm run db:migrate
npm run dev
```

## Vercel setup

Add `AI_API_KEY` (and optionally `AI_BASE_URL`, `AI_MODEL`) in
Project → Settings → Environment Variables, then redeploy. Without them the
production assistant reports `AI_NOT_CONFIGURED`.