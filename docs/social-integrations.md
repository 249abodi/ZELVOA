# ZELVOA — Social Publishing & Integration Operations

This document covers how the social publishing integrations are configured, how to
connect Facebook Pages and Instagram Business accounts to production, how the
scheduler works, and the current provider support matrix. Keep placeholders in
this file — never commit real secrets, tokens, or app credentials here.

## Provider support matrix

| Platform | Publishing | OAuth status | Notes |
| --- | --- | --- | --- |
| Facebook Pages | Ready | NOT_CONFIGURED | Requires Meta app + `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` |
| Instagram Business | Ready | NOT_CONFIGURED | Connects through the same Meta app (Facebook Login); `INSTAGRAM_*` optional fallback |
| LinkedIn | Ready | NOT_CONFIGURED | Requires `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET` |
| X (Twitter) | Ready | NOT_CONFIGURED | Requires `X_CLIENT_ID`/`X_CLIENT_SECRET` |
| TikTok | BLOCKED | — | Not implemented (no official API credentials) |
| YouTube | BLOCKED | — | Not implemented (no official API credentials) |

## Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | App | Production connection string, set in Vercel Project Settings |
| `AUTH_SECRET` | Auth | JWT signing secret |
| `ENCRYPTION_KEY` | Token storage | 32-byte hex; AES-256-GCM key for provider tokens |
| `NEXT_PUBLIC_APP_URL` | OAuth redirect | Must be `https://zelvoa.vercel.app` in production |
| `CRON_SECRET` | Scheduler | Sent by Vercel as `Authorization: Bearer <CRON_SECRET>` |
| `FACEBOOK_CLIENT_ID` | Facebook + Instagram OAuth | Meta app ID — the unified Meta app enables both platforms |
| `FACEBOOK_CLIENT_SECRET` | Facebook + Instagram OAuth | Meta app secret |
| `INSTAGRAM_CLIENT_ID` | Instagram OAuth (fallback) | Optional — only needed if you do not reuse the Meta app |
| `INSTAGRAM_CLIENT_SECRET` | Instagram OAuth (fallback) | Optional |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth | LinkedIn developer app ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth | LinkedIn developer app secret |
| `X_CLIENT_ID` | X OAuth | X developer app ID |
| `X_CLIENT_SECRET` | X OAuth | X developer app secret |
| `ALLOW_DEV_PROVIDERS` | Dev only | Never `true` in production |

Real values exist only in Vercel Project Settings / local `.env` (gitignored).
`.env.example` holds empty placeholders only.

## Meta (Facebook + Instagram) setup

Both Facebook Pages and Instagram Business connect through **one Meta app**
(Facebook Login). Instagram uses that same app: the user authorizes via the
Facebook Login dialog, then ZELVOA resolves the user's managed pages to their
linked Instagram Business/Creator accounts. Instagram-specific app credentials
(`INSTAGRAM_CLIENT_ID`/`INSTAGRAM_CLIENT_SECRET`) are optional and used only as a
fallback when the unified Meta app is not configured.

The Meta callback URL (must be registered in the Meta app) is fixed by the app:

```
https://zelvoa.vercel.app/api/v1/accounts/oauth/callback
```

### 1. Create the Meta app

1. Go to https://developers.facebook.com/apps and create a **Business** app.
2. Add the **Facebook Login** product to the app.
3. For Instagram, add the **Instagram Graph API** product (for a
   Business/Creator account; do not add "Basic Display").
4. In **App settings > Basic**, note the App ID and App Secret.

### 2. OAuth settings

1. In **Facebook Login > Settings**, set "OAuth for Business (Login as Business)"
   (needed for long-lived server tokens) and add the callback URL above to
   **Valid OAuth Redirect URIs** and `https://zelvoa.vercel.app` to **Allowed Domains**.
2. For local development, add `http://localhost:3000/api/v1/accounts/oauth/callback`
   as a second Valid OAuth Redirect URI. `NEXT_PUBLIC_APP_URL` in the local `.env`
   selects which one is used.

### 3. Required permissions

| Platform | Scopes ZELVOA requests |
| --- | --- |
| Facebook Pages | `pages_manage_posts`, `pages_read_engagement`, `pages_messaging` |
| Instagram Business | `instagram_content_publish`, `instagram_basic`, `pages_show_list` |

In Development mode, only app admins/developers/testers can complete the flow.
For a personal deployment, put the account that owns the Pages in that role. For
a commercial launch, the app must pass **App Review** for the permissions above
and be in **Live** mode, otherwise Graph API calls fail with an OAuthException.

### 4. Configure credentials

In Vercel Project Settings (never in chat or commits):

```
FACEBOOK_CLIENT_ID=<Meta App ID>
FACEBOOK_CLIENT_SECRET=<Meta App Secret>
```

Setting only the unified Meta app pair already enables Instagram — ZELVOA falls
back to `INSTAGRAM_CLIENT_ID`/`INSTAGRAM_CLIENT_SECRET` only when the Meta app
pair is absent. Redeploy after changing environment variables.

### 5. Connect

1. Sign in to ZELVOA → **Accounts**.
2. Click **Connect account** → choose Facebook or Instagram.
3. The app generates a single-use, 10-minute OAuth state bound to your user +
   workspace, then redirects to Meta Login.
4. Grant the requested permissions for the Page/Business you own.
5. Meta redirects back to `/api/v1/accounts/oauth/callback`, which validates the
   state, exchanges the code for a short-lived user token, exchanges that for a
   **long-lived** token, and:
   - **Facebook**: expands the profile into one account per managed Page, each
     storing its own page-scoped token.
   - **Instagram**: lists managed Pages and resolves each to its linked Instagram
     Business/Creator account (only those are stored; personal accounts are not
     returned by the Graph API). A clear error is returned if no Business/Creator
     Instagram account is available.

Access tokens are stored encrypted (AES-256-GCM via `ENCRYPTION_KEY`) and never
exposed through the API.

### 6. Token lifecycle & notifications

- Tokens are encrypted at rest and decrypted only inside the publishing / refresh
  flows in `src/lib/crypto.ts` and the provider adapters.
- Instagram long-lived user tokens expire after ~60 days and are refreshed by the
  app at `graph.instagram.com/refresh_access_token`. Facebook page tokens do not
  expire.
- The refresh endpoint (`POST /api/v1/accounts/{id}/refresh`, requires
  `accounts.manage`) renews tokens.
- Notifications: `TOKEN_EXPIRING` when a token nears expiry, `TOKEN_EXPIRED` when
  an expired token blocks publishing, `OAUTH_CONNECT_FAILED` when a connection
  attempt fails on the provider side.
- Disconnecting revokes the permission remotely best-effort and wipes stored
  tokens in a transaction.

### 7. Graph API version

The Meta adapters target **Graph API v25.0** (`graph.facebook.com/v25.0`,
`www.facebook.com/v25.0/dialog/oauth`). Older versions are dropped by Meta over
time — bump `GRAPH` in `src/lib/integrations/providers/meta.ts` and the endpoint
version strings in `src/lib/integrations/oauth-provider.ts` together.

## Troubleshooting

- `not configured` in the Accounts screen → the credential pair is missing/empty
  for that platform (Instagram also enables via the Meta app pair).
- "OAuthException (#200): (Permission denied)" → the user lacks the permission or
  the app is in Development mode and the user is not an app role. Run App Review
  or add the user as an admin/tester.
- "OAuthException (#190): access token expired" → reconnect the account or use
  Refresh; the scheduler marks the account `EXPIRED` and sends a `TOKEN_EXPIRED`
  notification.
- Instagram connects but no account appears → the connected Facebook profile is
  not an admin of any Page linked to a Business/Creator Instagram account.
- `503` on the scheduler → `CRON_SECRET` not set or mismatched.
- `connect_error` on /app/accounts after connecting → check `[oauth-callback]`
  server logs; provider error messages are redacted before logging.

## Scheduler

- Cron URL: `https://zelvoa.vercel.app/api/v1/scheduler/run`
- Runs once per day at 09:00 UTC via `vercel.json` (`0 9 * * *`; Hobby plan
  supports one scheduled run per day; publishing is best-effort per account with
  retries, so daily is deliberately conservative).
- Auth: requires `CRON_SECRET`. Vercel Cron automatically sends
  `Authorization: Bearer <CRON_SECRET>`; the route also accepts
  `x-cron-secret` or `?token=` for manual/local testing.
- Behavior: publishes due posts using the publishing service, then returns a
  summary. If `CRON_SECRET` is unset the endpoint returns `503` (deliberate —
  never leave the cron open).

## Manual run (locally)

```bash
CRON_SECRET="<value from your .env>" node -e "fetch('http://localhost:3000/api/v1/scheduler/run', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }).then(r => r.text()).then(t => console.log(t))"
```

## Publishing

- `POST /api/v1/posts/{id}/publish` publishes immediately (or on schedule) to the
  selected accounts. It claims the jobs atomically, so resubmits do not double
  publish.
- Server-side, publishing is best-effort per account with retries and safe error
  codes; jobs finalize as `PUBLISHED`, `RETRYING`, or `FAILED_PERMANENTLY`.
- Accounts in a `DISCONNECTED`/`REVOKED`/`EXPIRED` state are rejected before
  publishing as `ACCOUNT_INVALID`. Expired access tokens are only refreshed when
  the account is still `CONNECTED`; an `EXPIRED` account must be refreshed via
  `POST /api/v1/accounts/{id}/refresh` first.
- Rescheduling a post (`PATCH /api/v1/posts/{id}`) only schedules against
  `CONNECTED` accounts.
- Refreshed access and refresh tokens are re-encrypted (AES-256-GCM) in place —
  never stored in plaintext.
- Media is served via short-lived signed URLs for the provider adapters.
- All publishing writes audit entries and emits notifications to the post author.

## Security notes

- API routes enforce RBAC server-side (`src/lib/rbac.ts`); UI checks alone are
  never trusted. OAuth callbacks are anonymous by design but validate the
  single-use state.
- Every record is scoped to `organizationId` + `workspaceId`; cross-tenant reads
  are impossible via the API, and a workspace is only honored if it belongs to
  the member's organization.
- `AUTH_SECRET` fails closed in production: if it is missing, session signing and
  signature helpers throw instead of silently using the development fallback
  secret.
- Passwords are hashed with bcrypt (10 rounds). Legacy pre-bcrypt hashes remain
  verifiable; the next successful login does not rehash, so rotating old hashes
  is optional cleanup.
- AI usage quotas and per-user rate limits return `429` (with `Retry-After`),
  not generic `500`s.
- No fake integrations: a provider with no credentials reports
  `not configured`; unimplemented providers are `BLOCKED`. Nothing in this
  project pretends to publish without a real provider.