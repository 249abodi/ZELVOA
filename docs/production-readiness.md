# ZELVOA — Production Readiness

This document records the production-readiness audit and hardening work. It is
truthful about what is verified, what depends on external credentials, and what
still intentionally reports "coming soon" / "in development".

## Deployment status

- Live app: `https://zelvoa.vercel.app` (Vercel, Next.js 16).
- Release: `vercel-build = prisma migrate deploy && prisma generate && next build`.
- Postgres is hosted on the provider database; local development uses PostgreSQL
  on port `8080` (not `5432`).

## Verified (no credentials required)

The following were verified in a clean, credential-free environment:

- **Fresh migration replay passes.** `prisma migrate deploy` on an empty
  database applies all 4 migrations in order with no P3006 (this was the
  original blocker). Schema matches the Prisma model (32 tables, 98 indexes,
  63 foreign keys, 12 `NotificationType` values, 19 `ScheduledPost` columns).
- **Local `migrate status` is up to date** and `migrate diff` reports
  "No difference detected."
- **Migration history is order-safe.** `20260912212438_social_publishing` was
  made idempotent (guarded statements), and a corrective migration
  `20260913120002_reconcile_social_publishing` brings a fresh database in line
  with `schema.prisma` — so replay order can never break a fresh deploy.
- **Test suite**: 238 tests passing (`npm test -- --run`).
- **Typecheck**, **lint** (0 errors; a few pre-existing warnings), and
  **production build** all pass.
- **Publishing hardening**:
  - Refresh writes re-encrypted tokens (never plaintext) — regression tested.
  - `DISCONNECTED`, `REVOKED`, and `EXPIRED` accounts are rejected before
    publishing (`ACCOUNT_INVALID`) — regression tested.
  - Rescheduling only targets `CONNECTED` accounts.
  - Scheduler is locked behind `CRON_SECRET` (`503` without it).
- **Auth hardening**:
  - `AUTH_SECRET` fails closed in production (no silent dev fallback).
  - Passwords use bcrypt (10 rounds); legacy hashes still verify.
  - Workspace from the session is cross-checked against the member's
    organization.
- **RBAC is enforced server-side** on reads as well as writes (dashboard,
  approvals, post media, analytics, campaigns).
- **Security headers** are applied to app pages and API routes (nosniff,
  frame denial, CSP, HSTS in production).
- **AI quota/rate-limit** errors return `429` with `Retry-After` instead of `500`.
- Frontend no-op controls (notification toggles, approval-required toggle) are
  now disabled with a "Coming soon" hint rather than pretending to work.

## Depends on external credentials (NOT verified end-to-end)

Do not claim these are fully tested; they require credentials:

- **Real Meta OAuth/publishing** (Facebook + Instagram): credentials are not set
  in this environment, so live OAuth and live publishing were not executed. The
  adapters, refresh flow, and dev-mode mocks are covered by unit tests.
- **LinkedIn / X** OAuth: same — adapter code exists, live flow not executed.
- **AI assistant**: no provider API key set, so the endpoint is `NOT_CONFIGURED`
  (501) by design.
- **Inbox ingest** and **analytics snapshots**: real provider pulls require
  connected accounts; dev-mode providers exist for demonstration only.

## Known limitations (intentional)

- Password resets/change UI is not wired; the settings page shows a note.
- Notification/approval preference toggles and the workspace "approval required"
  switch are "coming soon" (disabled in the UI).
- `LAST_ACTIVE` / in-app notifications for all event types are not yet
  implemented.
- Scheduler runs once per day at 09:00 UTC (Vercel Hobby free tier limit).

## Secrets hygiene

- No secrets are committed. `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`,
  `CRON_SECRET`, provider secrets, and AI keys exist only in Vercel Project
  Settings and local `.env` (gitignored).
- Vercel masks secret values in the dashboard and logs.
- This document never prints or commits credential values.

## How to re-verify

```bash
npm test -- --run          # 238 tests
npm run lint               # 0 errors
npm run typecheck          # clean
npm run build              # production build
npx prisma migrate status  # "Database schema is up to date!"
```

To re-run the fresh-deploy check (needs a scratch Postgres on localhost:8080):

```bash
npx prisma migrate deploy  # on an empty database
```