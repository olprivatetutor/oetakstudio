@AGENTS.md

# Claude Code Instructions

`app_summary.md` is the canonical product, domain, architecture, security, and implementation specification for Oetak Studio.

`AGENTS.md` contains the canonical coding-agent engineering rules.

Both are binding. ADRs in `app_summary.md` take precedence over implementation convenience.

## Working Principles

Before making architectural, database, authorization, security, tenancy, AI, or cross-domain changes:

1. Read the relevant sections of `app_summary.md`.
2. Read and follow `AGENTS.md`.
3. Inspect the existing implementation before proposing changes.
4. Identify existing behavior that must be preserved.
5. Produce a concise implementation plan for non-trivial changes.
6. Prefer incremental changes over broad rewrites.
7. Implement only the requested scope.
8. Run relevant validation before declaring completion.

Do not invent missing business rules.

If the specification is ambiguous or conflicts with the existing implementation in a way that affects product behavior, security, data integrity, or architecture, surface the conflict before choosing a new rule.

## Scope Discipline

Respect capability classifications in `app_summary.md`:

* `[MVP]` — may be implemented when required by the current task.
* `[READY]` — architecture/interface may exist, but do not build the full feature unless requested.
* `[GROWTH]` — do not implement unless explicitly requested.
* `[SCALE]` — do not implement unless explicitly requested.

Do not opportunistically implement future roadmap features.

## Architecture

Oetak Studio is a modular monolith unless the canonical specification explicitly says otherwise.

Preserve domain boundaries.

Prefer:

API / Route
→ Application Service
→ Domain Logic
→ Repository
→ Database

Do not place significant business rules directly inside route handlers, React components, or raw database queries.

Do not create microservices without an explicit architectural decision.

## Database Changes

Database changes must be migration-driven.

For changes affecting existing data, prefer:

expand
→ backfill
→ compatibility/cutover
→ validate
→ contract

Avoid destructive migrations.

Never remove legacy columns or tables until:

* data has been migrated,
* application reads/writes have moved,
* tests pass,
* and runtime dependencies have been verified.

Use the `oetak-db-migration` skill for significant schema, RLS, tenancy, or migration work.

## Authorization and Security

Workspace is the tenant/security boundary.

Authorization must consider:

* authenticated identity,
* workspace membership,
* permission,
* resource relationship,
* domain rules,
* PostgreSQL RLS.

Never rely only on frontend visibility or application `WHERE workspace_id = ...` filtering for tenant isolation.

Do not weaken RLS, authentication, authorization, minor safety, guardian controls, auditability, or AI safety to simplify implementation.

## AI

Business features depend on AI capabilities, not hardcoded provider names.

Keep provider/model selection behind the AI provider abstraction.

AI-generated educational content must remain reviewable according to the canonical workflow.

Do not treat LLM self-reported confidence as authoritative system confidence.

## Testing

For every meaningful change, determine the smallest sufficient validation set.

Depending on the change, run:

* typecheck,
* unit tests,
* integration tests,
* migration tests,
* RLS isolation tests,
* authorization tests,
* E2E tests.

Security-sensitive changes require negative-path tests.

A feature is not complete merely because the happy path works.

## Completion Report

When finishing implementation, report:

1. What changed.
2. Important files changed.
3. Migrations added or modified.
4. Tests/validation executed.
5. Remaining risks or follow-up work.
6. Any deviation from `app_summary.md` or `AGENTS.md`.

Do not claim tests passed unless they were actually executed successfully.
