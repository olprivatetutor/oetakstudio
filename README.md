# Oetak Learning Platform

Oetak is a multi-tenant AI learning application built with Next.js App Router, React 19, PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, and shadcn/Radix UI.

## Phase 1 Features

- Verified email/password authentication, optional Google OAuth, TOTP MFA, Argon2id passwords, persistent rate limits, and session revocation.
- Organization tenancy with owner, admin, content, teacher, learner, and guardian roles; invitation and member management; guarded tenant resources and PostgreSQL RLS policies.
- Six learning tracks: formal school, ESP, language test preparation, general language, professional skills, and general enrichment.
- Searchable course catalog, organization/global builders, version snapshots, enrollments, module progress, learning assets, discussions, notifications, and certificates.
- AI course generation from source material with persisted jobs, structured validation, provider fallback, usage metering, and draft-only publishing behavior.
- Context-aware text tutor with persisted conversations, source-constrained responses, citations, rate limits, and usage/cost tracking.
- Deterministic objective assessment grading, attempt limits, cooldowns, and review state for subjective answers.
- Learner and organization analytics, placement flows, subscriptions, Stripe Checkout, signed webhooks, invoices, and plan catalog.
- Provider adapters for OpenAI, Anthropic, Gemini, DeepSeek, Deepgram speech-to-text, ElevenLabs text-to-speech, Resend email, and Stripe billing.

## Local Setup

```bash
cp .env.example .env
npm ci
npm run db:dev
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The development database listens on `localhost:5433` by default.

Real email, billing, speech, and AI requests require the matching provider keys in `.env`. `LLM_PROVIDER` selects the primary text provider and `LLM_FALLBACK_PROVIDERS` accepts a comma-separated fallback order. There is no mock-provider fallback.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run db:migrate
npm run db:seed
npm run db:studio
```

For containers, set a strong `BETTER_AUTH_SECRET`, provider variables as needed, and run `docker compose up --build`. `APP_DATABASE_URL` controls the database URL used inside the app container.

## Architecture

- `app/`: App Router pages and REST route handlers. Canonical integration endpoints use `/api/v1`; existing first-party routes remain available under `/api`.
- `features/`: bounded business capabilities such as organizations, billing, and content generation.
- `lib/services/`: learning, taxonomy, placement, discussion, and analytics orchestration.
- `lib/authorization/` and `lib/permissions.ts`: tenant-aware resource policies and RBAC checks.
- `lib/ai/`, `lib/email/`, and `lib/billing/`: provider interfaces, adapters, and factories.
- `db/schema/`: normalized Drizzle schemas, constraints, foreign keys, and indexes.
- `drizzle/`: ordered PostgreSQL migrations, including tenant RLS and subscription catalog data.
- `tests/`: focused policy, grading, and webhook-signature tests.

All route handlers validate input with Zod and return `{ success, data, message }` or `{ success: false, error }`. Resource authorization is performed in services, not only in the UI. Tenant-owned published content is visible only to active tenant members; global published content remains public.

## API Highlights

- `GET|POST /api/courses`
- `GET|PATCH|DELETE /api/courses/:courseId`
- `POST /api/courses/:courseId/enroll`
- `PATCH /api/modules/:moduleId/progress`
- `POST /api/assessments/:assessmentId/submit`
- `POST /api/v1/content/generate`
- `GET /api/v1/content/generate/:jobId`
- `POST /api/v1/ai/tutor/chat`
- `GET|POST /api/v1/organizations/:organizationId/members`
- `PATCH|DELETE /api/v1/organizations/:organizationId/members/:userId`
- `POST /api/v1/organizations/invitations/accept`
- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/subscription`
- `POST /api/v1/billing/subscribe`
- `POST /api/v1/webhooks/stripe`

The requirements source is [app_summary.md](app_summary.md). Role usage guidance is in [documentation/apps/user_role_guide.md](documentation/apps/user_role_guide.md).
