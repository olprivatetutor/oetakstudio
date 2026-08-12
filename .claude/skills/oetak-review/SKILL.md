---

name: oetak-review
description: Review Oetak Studio implementation changes against app_summary.md, AGENTS.md, architecture ADRs, security invariants, migration safety, tests, and MVP scope before merge.
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Oetak Implementation Review

Use this skill after meaningful implementation work and before merging architectural, database, authorization, assessment, AI, or other high-impact changes.

## Establish Review Scope

Inspect:

* `git status`
* `git diff`
* relevant commits if applicable
* changed migrations
* changed tests
* relevant sections of `app_summary.md`
* `AGENTS.md`

Review the implementation that actually exists, not the intended plan.

## Specification Compliance

Check whether the implementation:

* follows binding ADRs,
* respects `[MVP]`, `[READY]`, `[GROWTH]`, `[SCALE]`,
* preserves canonical domain ownership,
* avoids reintroducing deprecated architecture.

Flag undocumented deviations.

## Architecture

Check:

* domain boundaries,
* route/application/domain separation,
* transaction boundaries,
* dependency direction,
* unnecessary coupling,
* accidental microservice complexity,
* duplicate sources of truth.

Prefer correctness and maintainability over abstraction for abstraction's sake.

## Database

Review:

* migration safety,
* backfills,
* foreign keys,
* unique/check constraints,
* indexes,
* Drizzle/schema drift,
* compatibility,
* destructive changes.

For workspace-owned data, verify RLS.

## Authorization

Review:

* permission checks,
* workspace membership,
* relationship rules,
* domain invariants,
* RLS context.

Look specifically for IDOR and cross-workspace access.

## Course / Learning Domain

When relevant verify:

* Course vs CourseVersion separation,
* published version immutability,
* stable LearningObjectiveKey semantics,
* version-bound learning objectives,
* content/objective relationships,
* CourseOffering/Enrollment ownership.

## Assessment / Mastery

When relevant verify:

* assessment version pinning,
* item version pinning,
* attempt lifecycle,
* response persistence,
* grading ownership,
* mastery evidence,
* mastery recomputation,
* no client-authored mastery state.

## AI

When relevant verify:

* capability-based provider abstraction,
* execution auditability,
* grounding/RAG access control,
* real citations,
* review state for generated educational content,
* cost/usage handling,
* AI safety requirements.

## Tests

Check whether tests prove behavior rather than implementation details.

Expect negative tests for:

* security,
* lifecycle rules,
* RLS,
* authorization,
* migrations,
* idempotency.

Do not accept disabled or weakened tests as a substitute for fixing implementation.

## Review Output

Classify findings:

* P0 — must fix before proceeding
* P1 — must fix before merge/release
* P2 — should fix
* P3 — optional improvement

For each finding include:

* file/location,
* issue,
* why it matters,
* recommended correction.

Finish with one verdict:

* APPROVE
* APPROVE WITH FOLLOW-UPS
* CHANGES REQUIRED
