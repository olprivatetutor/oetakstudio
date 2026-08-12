---

name: oetak-implement
description: Implement Oetak Studio features safely from app_summary.md and AGENTS.md using repository inspection, scoped planning, implementation, testing, and completion reporting.
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Oetak Implementation Workflow

Use this skill for normal Oetak Studio feature implementation and significant refactoring.

## 1. Establish Scope

Read:

* `AGENTS.md`
* relevant sections of `app_summary.md`
* relevant existing source code
* relevant tests
* relevant migrations when database state is involved

Identify whether the requested capability is:

* `[MVP]`
* `[READY]`
* `[GROWTH]`
* `[SCALE]`

Do not expand the requested scope.

## 2. Inspect Before Editing

Determine:

* what already exists,
* what is aligned,
* what conflicts with the canonical specification,
* what can be reused,
* what dependencies exist,
* what data or API compatibility must be preserved.

Do not rewrite working systems solely to match a preferred coding style.

## 3. Plan

For non-trivial changes, produce a concise plan containing:

* affected domains,
* files/modules,
* database changes,
* API changes,
* authorization implications,
* migration/backfill requirements,
* tests,
* compatibility risks.

Resolve P0 architectural or security uncertainty before implementation.

## 4. Implement

Follow existing project conventions unless they conflict with the canonical specification.

Preserve domain boundaries.

Prefer:

Route
→ Application Service
→ Domain
→ Repository
→ Database

Keep business logic out of UI components and route handlers.

Use transactions when multiple writes form one business operation.

Use transactional outbox patterns for reliable asynchronous side effects when required by the canonical architecture.

## 5. Security Review

For workspace-owned operations verify:

* authentication,
* membership,
* permissions,
* resource relationship,
* domain rules,
* RLS context.

For sensitive mutations verify negative cases as well as success cases.

For minor users verify the applicable age-band, guardian, consent, and AI-safety rules.

## 6. AI Features

Use capability-based provider interfaces.

Do not introduce provider-specific business logic.

Record AI execution metadata required by the canonical specification.

Generated educational content must respect review/publish workflows.

## 7. Validate

Run relevant:

* typecheck,
* lint if configured,
* unit tests,
* integration tests,
* E2E tests,
* database migration checks.

Fix failures caused by the implementation.

Do not hide or disable failing tests merely to complete the task.

## 8. Completion Report

Report:

* implementation summary,
* important files,
* database/API changes,
* validation performed,
* unresolved issues,
* recommended next step.

Explicitly state anything that remains incomplete.
