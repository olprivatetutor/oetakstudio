---

name: oetak-db-migration
description: Plan, implement, and review PostgreSQL and Drizzle migrations for Oetak Studio, including workspace isolation, RLS, backfills, compatibility, and zero-data-loss migration strategy.
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Oetak Database Migration

Use this skill for schema migrations, tenancy changes, RLS, backfills, database constraints, and significant Drizzle schema changes.

## Source of Truth

Before editing:

1. Read `AGENTS.md`.
2. Read relevant database/security ADRs in `app_summary.md`.
3. Inspect current Drizzle schema.
4. Inspect existing migrations in order.
5. Inspect current runtime assumptions.
6. Identify whether production/existing data may be affected.

Never assume the schema definition alone represents deployed database state.

## Migration Strategy

For existing structures prefer:

expand
→ backfill
→ compatibility
→ cutover
→ validate
→ contract

Contract/destructive cleanup should normally be separated from the migration that introduces the replacement.

Never destroy existing data merely because the canonical schema changed.

## Drizzle

Keep:

* Drizzle schema,
* generated/manual SQL migrations,
* migration journal,
* runtime expectations

consistent.

Check for schema/migration drift.

Do not edit an already-applied migration unless there is an explicit and safe reason to do so.

Prefer a new migration.

## Workspace Isolation

Workspace is the canonical tenant boundary.

Workspace-owned tables must use the canonical workspace ownership strategy defined in `app_summary.md`.

Legacy organization tenancy may remain temporarily during migration, but must not become the basis for new architecture.

## PostgreSQL RLS

For workspace-owned data implement ADR-009 requirements.

Required properties include:

* `ENABLE ROW LEVEL SECURITY`
* `FORCE ROW LEVEL SECURITY`
* request-scoped `app.current_workspace_id`
* `USING`
* `WITH CHECK`
* runtime role is not table owner
* runtime role has no `BYPASSRLS`
* runtime role is not superuser
* migration/owner credentials are separate
* protected operations execute with workspace context
* missing workspace context fails closed

Never treat application-side `WHERE workspace_id = ...` as equivalent to RLS.

## Backfills

Backfills must be:

* deterministic,
* idempotent where practical,
* auditable,
* safe for existing rows.

Before setting `NOT NULL`, prove that required rows have been backfilled.

For ambiguous rows, do not guess ownership silently.

Surface them or define an explicit migration rule supported by the canonical specification.

## Constraints

Prefer database enforcement for invariants that the database can reliably enforce:

* foreign keys,
* unique constraints,
* check constraints,
* required fields.

Cross-row/domain invariants may require transactional application logic plus tests.

## Runtime Credentials

Maintain separation between:

Migration / Owner
and
Application Runtime

The application runtime must not bypass RLS.

Do not use owner/superuser credentials for normal protected business queries.

## Verification

For relevant migrations:

1. Apply migrations to a development/test database.
2. Confirm the migration journal is consistent.
3. Run Drizzle/schema validation where available.
4. Run typecheck.
5. Run relevant integration tests.
6. Verify backfilled data.
7. Verify constraints.
8. Test cross-workspace reads.
9. Test cross-workspace writes.
10. Test missing workspace context.
11. Confirm legacy compatibility when required.

## Completion Report

Report:

* migration files,
* schema changes,
* backfill performed,
* compatibility retained,
* RLS changes,
* validation performed,
* destructive work intentionally deferred,
* remaining migration risks.
