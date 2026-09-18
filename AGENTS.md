# ZELVOA — Agent instructions for this codebase.

## Project overview
A production-ready Social Media Management SaaS called **ZELVOA**.
- Stack: Next.js 16 + Prisma + PostgreSQL + Tailwind CSS v4 + JWT auth
- Design system: single CSS token system in `src/app/globals.css`
- Icons: centralized SVG system in `src/components/icons.tsx` (do NOT install lucide-react or other icon libraries)

## Development commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run db:generate  # prisma generate
npm run db:push      # prisma db push (quick sync schema)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # Seed plans
npm run db:studio    # Prisma Studio
```

## Important conventions
- Auth: JWT via `src/lib/session.ts`, cookie `zelvoa_session`
- Current user context: `getCurrentContext()` in `src/lib/auth.ts`
- RBAC permissions: `src/lib/rbac.ts` — roles: OWNER, ADMIN, CONTENT_MANAGER, DESIGNER, SOCIAL_MEDIA_MANAGER, VIEWER
- API routes: `src/app/api/v1/*/route.ts`
- Theme: class-based dark mode via `ThemeProvider` in `src/components/theme-provider.tsx`
- Design tokens: `:root` + `.dark` CSS variables in `src/app/globals.css`
- UI components: `src/components/ui/`
- Layout: `src/app/app/layout.tsx` with sidebar + header

## Database
- PostgreSQL on port 8080 (not 5432)
- Schema: `prisma/schema.prisma` — validate with `npx prisma validate`
- No mock data in production — mock providers only when explicitly in dev/demo mode

## Key rules
- No fake integrations — if an API isn't connected, show "coming soon" or "in development"
- No hardcoded colors — use design token CSS variables
- Multi-tenant: every record scoped via `organizationId`, `workspaceId`
- Backend must enforce RBAC — never rely on frontend-only permission checks
- Do NOT add comments unless explicitly asked
- No emojis unless the user explicitly requests them

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
