# AGENTS.md — Oetak Studio

## 1. Purpose

This file defines how coding agents (Codex, Claude Code, and similar tools) must work in this repository.

The canonical product and system specification is:

- `app_summary.md`

Treat `app_summary.md` as the primary source of truth for product behavior, domain rules, security boundaries, MVP scope, database semantics, API behavior, AI architecture, and acceptance criteria.

Do not invent or silently change core business rules that are already defined there.

---

## 2. Authority and Decision Precedence

When making implementation decisions, use this order:

1. Explicit instruction in the current task.
2. Binding ADR decisions in `app_summary.md` §0.3.
3. Canonical design rules in `app_summary.md` §0.1.
4. MVP scope and Definition of Done in §20.
5. Domain/API/database/security rules in the relevant specification sections.
6. Existing repository architecture and conventions, when they do not conflict with the canonical specification.
7. The smallest safe and reversible implementation choice.

If existing code conflicts with a binding ADR or canonical rule, do not propagate the contradiction. Prefer the canonical specification and clearly identify the conflict in the implementation summary.

Do not modify an ADR decision implicitly. A change to a binding ADR requires an explicit product/architecture decision and a new ADR.

---

## 3. Scope Discipline

The specification uses these labels:

- `[MVP]` — must be implemented for the first production-capable vertical slice.
- `[READY]` — data model/interface should anticipate the capability, but full implementation is not required yet.
- `[GROWTH]` — post-MVP capability.
- `[SCALE]` — enterprise/advanced/scale-stage capability.

Default rule:

> Implement only the scope required by the current task and the MVP. Do not build GROWTH/SCALE features merely because the architecture anticipates them.

Do not prematurely implement:

- realtime Voice AI Tutor;
- speaking assessment;
- essay AI scoring;
- diagnostic/placement testing;
- adaptive learning paths;
- adaptive testing / IRT;
- full guardian dashboard;
- predictive/dropout ML;
- knowledge graph;
- content marketplace;
- SCORM/H5P authoring;
- native mobile apps;
- enterprise SSO/SCIM;
- white-label/custom domains;
- large microservice architecture;
- Elasticsearch, Pinecone, or TimescaleDB unless a measured requirement justifies them.

Architecture may remain ready for these capabilities without implementing them.

---

## 4. Repository and Tooling Rules

Before changing code:

1. Inspect the repository structure.
2. Read `app_summary.md` sections relevant to the task.
3. Read existing local instructions (`README`, package scripts, lint/test config, migration conventions).
4. Reuse existing libraries, components, utilities, patterns, and design tokens before introducing new ones.
5. Inspect `package.json` and lockfiles to determine the existing package manager and scripts.

Do not:

- switch package managers;
- replace established libraries without explicit justification;
- introduce a second ORM;
- introduce a second validation library for the same boundary problem;
- add infrastructure because it is fashionable rather than required;
- make unrelated refactors in the same change.

Use currently supported stable/LTS versions only when introducing a new dependency. Exact versions belong in repository manifests, not in product logic.

---

## 5. Architecture Style

The MVP is a **modular monolith plus background workers**.

Preferred module boundaries:

```text
src/
├── modules/
│   ├── identity/
│   ├── workspace/
│   ├── organization/
│   ├── framework/
│   ├── course/
│   ├── learning/
│   ├── assessment/
│   ├── mastery/
│   ├── ai/
│   ├── billing/
│   ├── notification/
│   └── certification/
├── db/
│   ├── schema/
│   ├── migrations/
│   ├── seeds/
│   └── repositories/
├── jobs/
├── integrations/
└── shared/
    ├── authz/
    ├── errors/
    ├── idempotency/
    ├── outbox/
    └── redaction/
```

Use the dependency direction:

```text
Route / UI action
      ↓
Application service
      ↓
Domain rules
      ↓
Repository
      ↓
Database
```

Do not place important business rules directly inside route handlers or React components.

Modules communicate through application services and domain events. Do not import another module's repository to bypass its domain boundary.

Do not split modules into independent microservices unless an explicit ADR authorizes it.

---

## 6. Canonical Identity, Workspace, and Authorization Rules

These are non-negotiable invariants:

1. `User` is a global identity, not a tenant.
2. `Workspace` is the customer/security/data boundary.
3. A user may belong to multiple workspaces.
4. A workspace membership may hold multiple workspace roles.
5. Platform roles and workspace roles are separate scopes.
6. Never add a canonical `users.tenant_id` or single `users.role`.
7. `TEACHER` and `CONTENT_CREATOR` are separate roles.
8. Learner/guardian/teacher visibility is constrained by relationship and resource scope, not role alone.

Platform roles:

- `SUPER_ADMIN`
- `PLATFORM_CONTENT_ADMIN`

Workspace roles:

- `ORG_OWNER`
- `ORG_ADMIN`
- `TEACHER`
- `CONTENT_CREATOR`
- `LEARNER`
- `GUARDIAN`

Authorization result is conceptually:

```text
Role Permission
+ Workspace Scope
+ Resource Relationship
+ Domain Rules
```

Never authorize a protected action using only a frontend role check.

---

## 7. RLS and Tenant Isolation

Workspace-owned data must be protected by **application authorization plus PostgreSQL RLS**.

Required RLS properties:

- both `USING` and `WITH CHECK` policies;
- `FORCE ROW LEVEL SECURITY` on protected tables;
- application DB connection uses a non-owner role;
- business queries execute inside a transaction;
- set workspace context with `SET LOCAL` only after membership/permission validation;
- missing workspace context must fail closed;
- platform cross-workspace access uses explicit audited elevation, never disabled RLS.

Canonical request flow:

```text
Authenticate
→ resolve user
→ resolve workspace from request path/context
→ validate active membership or platform scope
→ evaluate permission + relationship
→ BEGIN
→ SET LOCAL app.current_workspace_id = ...
→ execute repository queries under RLS
→ COMMIT
```

Every new workspace-owned table must define its RLS policy and isolation tests in the same change.

Never rely only on application-side `WHERE workspace_id = ...` filtering.

---

## 8. Learning Domain Invariants

### 8.1 Learning Objective identity

A Learning Objective has two concepts:

- `LearningObjectiveKey` — stable identity across course versions;
- `LearningObjective` — version-bound course representation.

Mastery, prerequisites, and stable standard mappings anchor to the LO key, not the version-bound row.

Changing wording may retain the key. Changing the semantic meaning requires a new key.

### 8.2 Completion is not mastery

Never collapse these concepts:

- content completion;
- assessment performance;
- objective mastery.

Course completion percentages are derived read models. They are not authoritative mastery state.

### 8.3 Mastery ownership

Authoritative mastery is unique per:

```text
(workspace_membership_id, learning_objective_key_id)
```

Do not store enrollment-scoped mastery as the canonical truth. Enrollment mastery is a projection over the LO keys in the pinned course/template version.

Mastery must never be directly editable by a client.

### 8.4 Evidence

Mastery is derived from append-only evidence. Corrections supersede previous evidence; do not destructively rewrite academic history.

---

## 9. Course Versioning and Publishing

`Course` is the stable identity. `CourseVersion` is an immutable published snapshot.

Rules:

- only one open draft lineage (`DRAFT`, `IN_REVIEW`, or `NEEDS_REVISION`) per course;
- published versions are immutable;
- editing published content creates a new version;
- active offerings remain pinned to the version they were created with;
- course migration is explicit and audited;
- mastery survives version publication because mastery anchors to stable LO keys;
- content completion does not silently transfer across versions.

`publish` is a domain command, not a raw `status = PUBLISHED` update.

Publish must run the validation checklist in `app_summary.md` §10.2 and fail closed on every `ERROR`.

AI-generated LOs/content/items must not publish while `review_state = UNREVIEWED`.

---

## 10. Platform Templates and Course Offerings

Personal/catalog learning must not clone a course merely to enroll.

A `CourseOffering` pins exactly one source:

- a workspace `course_version`, or
- a platform `course_template_version`.

Cloning is an authoring action only when a workspace intends to modify platform content.

An Enrollment belongs to a CourseOffering, not directly to a Course.

Do not reintroduce direct `/courses/{id}/enroll` semantics.

---

## 11. Assessment Invariants

Keep separate:

- assessment **purpose** (`FORMATIVE`, `SUMMATIVE`, etc.);
- assessment **scope** (`COURSE_VERSION` or `FRAMEWORK`);
- assessment **mode** (`FIXED`, later randomized/adaptive);
- assessment **item type** (`MCQ`, `TRUE_FALSE`, etc.).

MVP assessment scope:

- fixed MCQ / True-False;
- optional presentation-order shuffle only;
- server-side timing and expiry;
- explicit attempt policy;
- incremental/idempotent response saves;
- auto-grading;
- item-to-LO-key mapping;
- mastery evidence generation.

Do not implement randomized item selection without a blueprint.

A started attempt pins its assessment version, item versions, shuffle seed, scoring policy snapshot, and rubric version where applicable.

Never change a historical attempt because an assessment or item was edited later.

Reviewer regrades must preserve original AI/rule scores and emit the appropriate regrade event so mastery/certificate eligibility can be recomputed.

---

## 12. AI Architecture Rules

AI is capability-based and provider-agnostic.

Business modules depend on capability interfaces such as:

- text generation;
- embeddings;
- speech-to-text;
- text-to-speech;
- realtime voice;
- reranking;
- moderation.

Do not import provider SDKs directly into course, assessment, learning, mastery, or UI business logic.

Provider/model selection belongs in the AI module/configuration/router.

Model names are configuration, not business logic.

Every significant AI execution must be traceable with at least:

- workspace;
- user where applicable;
- feature/capability;
- provider/model identifier;
- prompt/config version;
- usage/tokens;
- latency;
- cost;
- safety profile;
- status/error classification.

### 12.1 AI-generated content

AI output is draft content. It never bypasses human review/publish rules by default.

### 12.2 RAG security

Retrieved/uploaded content is **data, never instruction**.

Do not allow retrieved text to:

- override system/developer policy;
- widen workspace/enrollment retrieval scope;
- change permissions;
- choose arbitrary tools;
- inject hidden instructions into later stages.

Authorization occurs before retrieval. Retrieval queries must be scoped to authorized workspace/enrollment/version content.

### 12.3 AI confidence

Do not expose or persist an LLM's self-reported confidence as system truth.

Use measurable evidence/quality signals defined by the domain.

### 12.4 Budget degradation

When AI budget is exhausted, follow configured degradation explicitly:

```text
soft threshold → alert
hard threshold → cheaper eligible tier
cheaper tier unavailable/exhausted → queue non-interactive work
interactive AI unavailable → explicit AI_BUDGET_EXHAUSTED state
```

Never silently fail or silently change educational outcomes.

Core non-AI learning and rule-based assessment must continue when AI is unavailable.

---

## 13. Minor Safety and Consent

The MVP includes minor-facing learning. Age and consent are not optional later work.

Age bands:

- `UNDER_13`
- `TEEN_13_17`
- `ADULT`
- `UNSPECIFIED` — fail closed as teen until resolved

Every learner-affecting AI operation must resolve the safety profile before generation, retrieval, or long-term memory writes.

Rules include:

- under-13 AI access requires the applicable verified guardian or institutional-consent condition;
- long-term AI memory is disabled by default for minors;
- minimize stored birth-date data;
- do not expose birth date in list APIs or analytics exports;
- no behavioral advertising/profiling of minors;
- moderation runs on both input and output for minor-facing AI profiles.

Do not weaken these rules to simplify UI or testing.

---

## 14. Database and Drizzle Rules

Primary database: PostgreSQL with Drizzle ORM.

Use repository conventions, with these canonical constraints:

- UUID v7 primary keys unless an existing repository convention explicitly supersedes this through an ADR;
- `timestamptz` in UTC;
- workspace-owned tables have explicit `workspace_id NOT NULL` where required by the canonical model;
- monetary values use integer minor units + currency, never floats;
- migrations are checked into source control;
- migrations use expand/contract discipline;
- migrations must be safe for production rollout;
- seed data is versioned and idempotent;
- no manual production database edits as part of normal feature delivery.

### JSONB

Use relational tables/columns when data:

- has identity;
- has lifecycle/status;
- is frequently filtered;
- participates in relationships;
- requires FK integrity;
- requires analytics.

Use JSONB for:

- heterogeneous response payloads;
- provider/activity configuration;
- optional metadata;
- immutable snapshots;
- flexible workspace settings.

Every JSONB field used by application code must have a defined TypeScript/Zod schema.

Do not put assessment item identity, roles, permissions, mastery, LO relationships, or billing ownership into opaque JSON blobs.

---

## 15. Reliability and Domain Events

Critical cross-process side effects use the transactional outbox pattern.

State change and outbox insert occur in the same database transaction.

Delivery semantics are at-least-once. Consumers must be idempotent using `processed_events` or the canonical equivalent.

Examples of domain events include:

- `CourseVersionPublished`
- `AssessmentSubmitted`
- `AssessmentGraded`
- `AttemptRegraded`
- `MasteryUpdated`
- `OfferingMigrated`
- `SubscriptionChanged`

Anything a client can safely retry must support idempotency where specified, especially:

- enrollment;
- assignment;
- assessment submission;
- content-generation jobs;
- checkout/subscription creation;
- other externally retryable commands.

Do not claim exactly-once transport. Achieve exactly-once effects from the consumer's perspective through idempotent processing.

---

## 16. API Rules

REST APIs use the canonical business model rather than exposing tables 1:1.

Prefer explicit workspace-scoped routes for workspace resources:

```text
/api/v1/workspaces/{workspaceId}/...
```

Examples of canonical semantics:

- enrollment is against a CourseOffering;
- progress/mastery is read in enrollment/learner context;
- publishing is a command on a specific version;
- AI scoring is an internal assessment capability, not an arbitrary learner-facing endpoint;
- recommendation results are structured domain outputs, not unrestricted "ask AI what next" calls.

Use stable machine-readable error codes.

Validate all external boundaries with Zod.

Use cursor pagination for high-volume/time-ordered resources; simple page/limit pagination is acceptable for small administrative lists.

---

## 17. Frontend Rules

Use the existing Next.js App Router architecture, React, TypeScript, Tailwind CSS, and shadcn/ui conventions in the repository.

Frontend responsibilities:

- presentation;
- user interaction;
- client-side form state;
- optimistic UX only where rollback is safe;
- rendering server-authorized capabilities.

Frontend must not be the source of truth for:

- authorization;
- workspace isolation;
- assessment timing;
- mastery calculation;
- publish eligibility;
- billing entitlement;
- AI safety/consent decisions.

Server responses must remain authoritative.

For async operations, provide explicit states for:

- loading;
- success;
- empty;
- permission denied;
- recoverable error;
- AI degraded/unavailable;
- workspace billing restriction;
- retry where safe.

Responsive/mobile-first web is MVP. Native mobile is not.

---
## 18. UI/UX and Visual Identity

All UI/UX implementation must follow the canonical visual identity defined in
`app_summary.md` and `docs/ui-ux-design-system.md`.

Non-negotiable rules:

- Primary brand color: `#274029`
- Secondary brand color: `#624F8C`
- Do not introduce arbitrary primary brand palettes.
- Human illustration characters must follow the canonical Muslim modesty
  guidelines.
- Human characters must be faceless.
- Male characters must use modest clothing with non-isbal trousers.
- Female characters must use loose modest clothing and a long hijab covering
  the hair, neck, and chest.
- These rules also apply to prompts used for AI-generated visual assets.

Before creating or modifying UI, inspect and reuse existing design tokens,
components, and patterns.

---

## 19. Testing Requirements

Every implementation must add or update tests appropriate to the change.

At minimum, critical domain rules require automated coverage for:

- workspace isolation on reads and writes;
- missing workspace context fails closed;
- membership/role authorization;
- teacher/guardian relationship scope;
- pending guardian relationship grants no learner access;
- immutable published versions;
- each publish-validation `ERROR` condition;
- CourseOffering version/template pinning;
- course migration dry-run correctness;
- stable LO-key mastery surviving course version publication;
- assessment attempt limits, expiry, cooldown, and idempotent submission;
- evidence selection policy;
- mastery recomputation;
- AI retrieval authorization and prompt-injection isolation;
- outbox relay/consumer deduplication;
- payment webhook deduplication when billing is touched.

Use:

- unit tests for domain rules;
- integration tests for database/RLS/repositories;
- Playwright for critical end-to-end flows.

Before declaring a task complete, run the repository's existing equivalents of:

```text
lint
format/check
TypeScript typecheck
tests
production build
migration validation (when schema changed)
```

Use the scripts defined by the repository; do not invent command names when `package.json` already defines them.

---

## 20. MVP End-to-End Definition of Done

When work affects the MVP vertical slice, protect the complete flow in `app_summary.md` §20.4:

```text
Register + age band + verification
→ Personal Workspace
→ Organization Workspace
→ invitation/membership/roles
→ author/create or clone course
→ upload source safely
→ async AI draft generation
→ human review
→ validate/publish immutable CourseVersion
→ create pinned CourseOffering
→ learner assignment/enrollment
→ Learning Player
→ completion tracking
→ MCQ attempt with server-side policy
→ grading
→ mastery evidence
→ membership-level LO mastery
→ separate completion/mastery display
→ age/consent-gated grounded AI Tutor
→ authorized teacher/guardian progress view
→ workspace isolation
→ version migration dry run
→ auditable AI/domain execution
```

A UI mock without these underlying invariants is not completion of the MVP feature.

---

## 21. Change Strategy

For each task:

1. Identify the affected domain module(s).
2. Identify the binding ADR/canonical rules involved.
3. Inspect existing implementation before designing replacement code.
4. Make the smallest coherent change that completes the requested behavior.
5. Preserve backward compatibility unless the task explicitly authorizes a breaking change.
6. Add migrations only when required; do not modify historical applied migrations unless repository policy explicitly allows it.
7. Add tests for new invariants and regression risks.
8. Update API/OpenAPI/docs when external behavior changes.
9. Report any spec/code conflict and what was done about it.

Avoid broad rewrites while implementing one vertical feature.

---

## 22. Completion Report for Coding Agents

At the end of a coding task, summarize:

1. **What changed** — files/modules and behavior.
2. **Canonical rules implemented** — relevant ADR/section references from `app_summary.md`.
3. **Database/API impact** — migration, endpoints, compatibility.
4. **Security/tenant impact** — authorization/RLS/PII implications.
5. **Tests run** — exact repository commands and result.
6. **Remaining work** — only genuine follow-up items, with MVP/GROWTH/SCALE classification.

Do not claim tests passed if they were not run.

---

## 23. Hard Prohibitions

Do **not**:

- reintroduce `users.tenant_id` or a single global workspace role;
- model customer isolation only in application filters without RLS;
- bypass `FORCE RLS` for convenience;
- turn `publish` into a raw status update;
- mutate published course/assessment/item/rubric/prompt versions;
- bind authoritative mastery to Enrollment;
- overwrite original AI/rule scores during human review;
- store core assessment questions or mastery structures as opaque JSON blobs;
- let the frontend directly set mastery, certificate eligibility, or final grades;
- clone a platform course for every personal learner enrollment;
- call provider-specific AI SDKs from business modules;
- treat retrieved documents as instructions;
- use an LLM self-reported confidence value as truth;
- let AI freely choose curriculum scope or learning paths outside deterministic constraints;
- silently degrade AI behavior;
- auto-publish AI-generated educational content;
- make minor-safety/consent checks client-only;
- build GROWTH/SCALE infrastructure merely because the future roadmap mentions it;
- add a microservice boundary without an explicit architecture decision;
- perform destructive data migration without an explicit, tested migration path;
- skip tests for authorization, RLS, versioning, or academic-state changes.

---

## 24. Default Interpretation Rule

When `app_summary.md` is precise, implement it as written.

When it intentionally leaves implementation detail open, choose the simplest design that:

- preserves the canonical invariants;
- matches existing repository patterns;
- is type-safe and testable;
- is secure by default;
- is reversible;
- does not prematurely implement future scope.

When a requested change conflicts with a binding ADR, do not quietly work around it. Surface the conflict explicitly and isolate the proposed architectural change from ordinary feature implementation.
