---

name: oetak-security-review
description: Review Oetak Studio changes for authentication, workspace isolation, RBAC, RLS, IDOR, minor safety, AI safety, secrets, uploads, billing webhooks, and other security-sensitive behavior.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Oetak Security Review

Use this skill for security reviews and whenever implementation changes authentication, authorization, tenancy, RLS, minors, AI, file handling, billing, or privileged operations.

Review against `AGENTS.md`, `app_summary.md`, and relevant ADRs.

## Authentication

Check:

* session validation,
* session expiration,
* logout/revocation behavior,
* sensitive endpoint authentication,
* no trust in client-supplied identity.

Do not redesign working authentication without a canonical requirement.

## Workspace Isolation

For every workspace-owned resource verify:

* workspace context is explicit,
* user has active membership when required,
* resource belongs to the workspace,
* cross-workspace IDs cannot bypass authorization,
* RLS provides database-level isolation.

Test IDOR scenarios.

## RBAC

Authorization must be permission-based.

Check:

* multiple membership roles,
* union of role permissions,
* role removal,
* platform roles separated from workspace roles,
* privileged operations,
* relationship-based restrictions.

Do not introduce new hardcoded role arrays.

## PostgreSQL RLS

Verify:

* RLS enabled,
* RLS forced,
* paired `USING` and `WITH CHECK`,
* runtime role cannot bypass RLS,
* runtime role does not own protected tables,
* workspace GUC set transaction-locally,
* missing context fails closed,
* reads and writes are tested.

## Domain Invariants

Review security-relevant domain rules such as:

* last `ORG_OWNER` cannot be removed/demoted,
* published versions cannot be silently mutated,
* mastery cannot be arbitrarily changed by clients,
* assessment attempts respect lifecycle rules.

## Minor Safety

When learner age may be below the applicable threshold, review:

* age-band handling,
* guardian relationship,
* consent requirements,
* communication restrictions,
* AI safety profile,
* data minimization.

Do not weaken minor protections for implementation convenience.

## AI Security

Check:

* provider credentials remain server-side,
* provider abstraction is preserved,
* user content cannot alter system authorization rules,
* RAG retrieval respects workspace access,
* citations refer to accessible sources,
* generated content follows review policy,
* usage/budget limits fail safely,
* LLM self-confidence is not treated as authoritative confidence.

## File Uploads

Check:

* authorization before upload intent,
* MIME/type validation,
* size limits,
* safe object keys,
* no executable-path assumptions,
* private storage where appropriate,
* signed URL expiration,
* asset ownership.

## Billing / Webhooks

Check:

* signature verification,
* event deduplication,
* idempotent processing,
* no client-controlled subscription state,
* replay resistance,
* auditability.

## Secrets

Check that secrets are not:

* committed,
* logged,
* returned to clients,
* stored in unsafe configuration.

## Negative Tests

Security-sensitive implementation must include adversarial tests where relevant:

* cross-workspace read,
* cross-workspace write,
* unauthorized role,
* removed membership,
* missing RLS context,
* manipulated resource ID,
* duplicate webhook,
* invalid upload,
* invalid lifecycle transition.

## Output

Classify findings:

* P0 — exploitable or fundamental security boundary failure
* P1 — serious weakness required before MVP/release
* P2 — defense-in-depth improvement
* P3 — future hardening

For each finding include:

* evidence,
* impact,
* exploit/failure scenario,
* recommended fix,
* required test.
