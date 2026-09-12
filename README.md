# ZELVOA

Production-ready Social Media Management SaaS built with Next.js 16, Prisma, PostgreSQL, Tailwind CSS v4, and JWT auth.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT sessions (`zelvoa_session` cookie), RBAC roles (OWNER, ADMIN, CONTENT_MANAGER, DESIGNER, SOCIAL_MEDIA_MANAGER, VIEWER)
- **Styling**: Tailwind CSS v4 with a single design-token system in `src/app/globals.css`
- **Icons**: centralized SVG system in `src/components/icons.tsx` (no icon libraries)

## Getting started

```bash
npm install
npm run db:generate      # Prisma client
npm run db:push          # sync schema to local dev DB
npm run db:seed          # seed plans
npm run dev              # http://localhost:3000
```

Local PostgreSQL runs on port **8080** (not 5432). See `.env.example` for the required environment variables.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run db:migrate   # create/apply a migration
```

## Social integrations

ZELVOA connects external platforms through OAuth2.

- **Provider registry** (`src/lib/integrations/platforms.ts`, `registry.ts`) exposes per-platform configuration status. A platform is only shown as available once its credentials are set in the environment.
- **Publishing adapters** implement `publish`/`getAccounts`/`getPublishingStatus`: Facebook Pages and Instagram (Meta Graph API), LinkedIn (`/rest/shares`, text-only), and X (`/2/tweets`, text-only). TikTok and YouTube publishing is not implemented yet and is surfaced honestly as "in development".
- **Publishing service** (`src/lib/publishing/service.ts`) claims due jobs atomically, applies platform limits, signs media URLs, retries with exponential backoff, and records safe error codes — raw provider errors are never stored.
- **Scheduler** (`/api/v1/scheduler/run`) pumps due jobs. It is protected by `CRON_SECRET` and wired to a Vercel Cron (`vercel.json`) that sends `Authorization: Bearer <CRON_SECRET>`.
- **Notifications** (`/api/v1/notifications`) surface account connections, token expirations, and publishing outcomes in the header bell.
- **Development providers**: `ALLOW_DEV_PROVIDERS=true` enables a built-in mock provider for local workflows. It is never enabled in production.

## Rules

- No fake integrations: an API that is not connected shows "coming soon" or "in development".
- No mock data in production.
- Multi-tenant: records are scoped by `organizationId` and `workspaceId`; the backend enforces RBAC on every route.
- Provider tokens are encrypted at rest (`ENCRYPTION_KEY`) and never returned by the API.