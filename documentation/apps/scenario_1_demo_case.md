# Scenario 1 Demo Case: Merdeka Grade 11 Trigonometry

## Context

Scenario ini mengikuti `app_summary.md` bagian **Scenario 1: High School Student - Mathematics (Merdeka Curriculum)**.

- Student: Aisha Rahma
- Content Track: School Curriculum (`SCH`)
- Curriculum: Kurikulum Merdeka (`MER`)
- Level: SMA
- Grade: Kelas 11
- Subject: Mathematics (`MATH`)
- Learning Objective: Trigonometric Functions
- School Tenant: SMA Merdeka Nusantara Demo
- Course: Scenario 1: Merdeka Grade 11 Trigonometric Functions

## Login Credentials

Semua akun Scenario 1 menggunakan password yang sama:

```text
Scenario@2026!
```

| Role | Email | Password | Primary Route |
|------|-------|----------|---------------|
| School Tenant Owner | owner.sma-merdeka@oetakstudio.local | Scenario@2026! | /dashboard/organization |
| School Admin | admin.sma-merdeka@oetakstudio.local | Scenario@2026! | /dashboard/organization |
| Math Teacher | teacher.siti@oetakstudio.local | Scenario@2026! | /dashboard/builder, /dashboard/organization |
| Student / Aisha | aisha.grade11@oetakstudio.local | Scenario@2026! | /dashboard/learning, /dashboard/placement |
| Parent Observer | parent.aisha@oetakstudio.local | Scenario@2026! | /dashboard/notifications |
| App Owner | owner@oetakstudio.local | Owner@2026! | /admin |
| Content Manager | content@oetakstudio.local | Content@2026! | /content |

## Seeded Data

- Organization: `SMA Merdeka Nusantara Demo`
- Organization type: `school`
- Curriculum mode: `inherited`
- Primary content track: `SCH`
- Subscription: active `pro`, 30 seats
- Course: `Scenario 1: Merdeka Grade 11 Trigonometric Functions`
- Modules:
  - Trigonometric ratios baseline
  - Trigonometric identities booster
  - Applications and reflection
- Student enrollment:
  - Aisha is enrolled in the Scenario 1 course
  - Progress is seeded at 33%
  - First module completed, second in progress, third not started
- Placement test:
  - Scope: `strict_lo_scope`
  - Score: 72%
  - Recommended level: intermediate
- Discussion:
  - `Scenario 1: Aisha trigonometry support`
- Notifications:
  - Student placement result notification
  - Teacher follow-up notification
  - Parent observer demo notification

## Suggested Test Flow

1. Login as `aisha.grade11@oetakstudio.local`.
2. Open `/dashboard/learning` and continue the Scenario 1 course.
3. Open `/dashboard/placement` to see or run scoped Merdeka placement.
4. Login as `teacher.siti@oetakstudio.local`.
5. Open `/dashboard/organization` and `/dashboard/discussions` to review class context and support thread.
6. Login as `admin.sma-merdeka@oetakstudio.local` or `owner.sma-merdeka@oetakstudio.local` to inspect tenant membership and organization dashboard.
7. Login as `owner@oetakstudio.local` and open `/admin/taxonomy` or `/admin/tenants` to inspect the tenant from App Owner perspective.
8. Login as `content@oetakstudio.local` and open `/content/taxonomy` to inspect the Merdeka taxonomy and learning objectives.

## Notes

The current organization RBAC enum supports `owner`, `admin`, `teacher`, and `student`. Parent is seeded as an individual observer account because `parent` is not yet a first-class organization role in the current schema.
