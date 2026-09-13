# ZELVOA — Social Publishing & Integration Operations

This document covers how the social publishing integrations are configured, how to
connect Facebook Pages and Instagram Business accounts to production, how the
scheduler works, and the current provider support matrix. Keep placeholders in
this file — never commit real secrets, tokens, or app credentials here.

## Provider support matrix

| Platform | Publishing | OAuth status | Notes |
| --- | --- | --- | --- |
| Facebook Pages | Ready | NOT_CONFIGURED | Requires Meta app + `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` |
| Instagram Business | Ready | NOT_CONFIGURED | Requires Meta app + `INSTAGRAM_CLIENT_ID`/`INSTAGRAM_CLIENT_SECRET` |
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
| `FACEBOOK_CLIENT_ID` | Facebook OAuth | Meta app ID |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth | Meta app secret |
| `INSTAGRAM_CLIENT_ID` | Instagram OAuth | Meta app ID (Instagram product) |
| `INSTAGRAM_CLIENT_SECRET` | Instagram OAuth | Meta app secret |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth | LinkedIn developer app ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth | LinkedIn developer app secret |
| `X_CLIENT_ID` | X OAuth | X developer app ID |
| `X_CLIENT_SECRET` | X OAuth | X developer app secret |
| `ALLOW_DEV_PROVIDERS` | Dev only | Never `true` in production |

Real values exist only in Vercel Project Settings / local `.env` (gitignored).
`.env.example` holds empty placeholders only.

## Meta (Facebook + Instagram) setup

The Meta callback URL (must be registered in the Meta app) is fixed by the app:

```
https://zelvoa.vercel.app/api/v1/accounts/oauth/callback
```

### 1. Create the Meta app

1. Go to https://developers.facebook.com/apps and create a Business app.
2. Add the **Facebook Login** and **Instagram** (Instagram Basic Display + Instagram
   Graph API) products to the app.

### 2. OAuth settings

1. In **Settings > Basic**, note the App ID and App Secret.
2. In **Facebook Login > Settings**, add the callback URL above to both
   "Valid OAuth Redirect URIs" and "Allowed Domains" (`https://zelvoa.vercel.app`).
3. Same for **Instagram > Settings** if it exposes its own redirect URI list.
4. Use "OAuth for Business (Login as Business)" permission type so app tokens can
   be long-lived and used by the server.

### 3. Required permissions

| Platform | Scopes ZELVOA requests |
| --- | --- |
| Facebook Pages | `pages_manage_posts`, `pages_read_engagement`, `pages_messaging` |
| Instagram Business | `instagram_content_publish`, `instagram_basic`, `pages_show_list` |

The app must be in **Live** mode (not Development) and be approved for these
permissions, otherwise Graph API v18.0 calls fail with an OAuthException. For a
personal single-owner deployment, adding yourself as an admin/developer is enough.

### 4. Configure credentials

In Vercel Project Settings, set (never in chat or commits):

```
FACEBOOK_CLIENT_ID=<Meta App ID>
FACEBOOK_CLIENT_SECRET=<Meta App Secret>
INSTAGRAM_CLIENT_ID=<Meta App ID>
INSTAGRAM_CLIENT_SECRET=<Meta App Secret>
```

Then redeploy so the environment is applied.

### 5. Connect

1. Sign in to ZELVOA → **Accounts**.
2. Click **Connect account** → choose Facebook or Instagram.
3. The app generates a single-use, 10-minute OAuth state bound to your user +
   workspace, then redirects to Meta Login.
4. Grant the requested permissions for the Page/Business you own.
5. Meta redirects back to `/api/v1/accounts/oauth/callback`, which validates the
   state, exchanges the code, encrypts the tokens, and redirects to
   `/app/accounts`.

Access tokens are returned from OAuth as Short-Lived and can be exchanged for
Long-Lived server tokens; the app stores them encrypted (AES-256-GCM via
`ENCRYPTION_KEY`) and never exposes them through the API.

### 6. Token lifecycle

- Tokens are encrypted at rest and decrypted only inside the publishing /
  refresh flows in `src/lib/crypto.ts` and the provider adapters.
- The refresh endpoint (`POST /api/v1/accounts/{id}/refresh`, requires
  `accounts.manage`) renews tokens; the scheduler surface notifies the user on
  failures (`TOKEN_EXPIRING` notification).
- Disconnecting revokes remotely best-effort and wipes stored tokens in a
  transaction.

## Scheduler

- Cron URL: `https://zelvoa.vercel.app/api/v1/scheduler/run`
- Runs once per day at 09:00 UTC via `vercel.json` (`0 9 * * *`; Hobby plan
  supports one scheduled run per day).
- Auth: requires `CRON_SECRET`. Vercel Cron automatically sends
  `Authorization: Bearer <CRON_SECRET>`; the route also accepts
  `x-cron-secret` or `?token=` for manual/local testing.
- Behavior: publishes due posts (status `SCHEDULED`, `scheduledAt <= now`) using
  the publishing service, then returns a summary. If `CRON_SECRET` is unset the
  endpoint returns `503` (deliberate — never leave the cron open).

## Manual run (locally)

```bash
CRON_SECRET="<value from your .env>" node -e "fetch('http://localhost:3000/api/v1/scheduler/run', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }).then(r => r.text()).then(t => console.log(t))"
```

## Publishing

- `POST /api/v1/posts/{id}/publish` publishes immediately (or on schedule) to the
  selected accounts. It claims the accounts atomically, so resubmits do not double
  publish.
- Server-side, publishing is best-effort per account with retries and safe error
  codes; result statuses are `PUBLISHED`, `FAILED`, `PARTIAL`, `SKIPPED`.
- Media is served via short-lived signed URLs for the provider adapters.
- All publishing writes audit entries (`post.publish`, `account.publish_failed`,
  `account.token_expired`, …) and emits notifications to the requesting user.

## Security notes

- API routes enforce RBAC server-side (`src/lib/rbac.ts`); UI checks alone are
  never trusted. OAuth callbacks are anonymous by design but validate the
  single-use state.
- Every record is scoped to `organizationId` + `workspaceId`; cross-tenant reads
  are impossible via the API.
- No fake integrations: a provider with no credentials reports
  `not configured`; unimplemented providers are `BLOCKED`. Nothing in this
  project pretends to publish without a real provider.