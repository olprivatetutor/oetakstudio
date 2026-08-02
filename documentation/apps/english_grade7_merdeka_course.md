# Kurikulum Merdeka English Grade 7 Course

## Course

**Title:** Kurikulum Merdeka English Grade 7: Pathway Foundations  
**Track:** School Curriculum (`SCH`)  
**Curriculum:** Kurikulum Merdeka (`MER`)  
**Level:** SMP  
**Grade:** Kelas 7  
**Subject:** English (`ENG`)  
**Owner:** Platform Content Manager  
**Scope:** Global catalog course, not tied to any tenant organization.

Reference source stored in metadata:

`documentation/module/sch/eng/mer/grade7/Pathway to English 1 - BG.pdf`

The seeded content adapts the reference into platform-native learning objectives, modules, materials, and interactive blueprints. It does not copy long passages from the PDF.

## Learning Objectives

| ID | Topic | Objective |
|---|---|---|
| `LO-ENG-7-001` | Classroom interaction | Use simple English expressions for greetings, routines, clarification, and turn-taking. |
| `LO-ENG-7-002` | Self and others | Introduce self and others through spoken and written profiles. |
| `LO-ENG-7-003` | Describing people and places | Read and compose short descriptive texts about familiar contexts. |
| `LO-ENG-7-004` | Daily routines and preferences | Exchange information about routines, schedules, likes, and dislikes. |
| `LO-ENG-7-005` | Instructions and procedures | Understand and produce short instructions or procedure texts. |
| `LO-ENG-7-006` | Short messages and presentation | Interpret short messages and present a simple multimodal project. |

## Modules

1. Starter diagnostic: English for classroom confidence
2. Classroom language, routines, and learning habits
3. Introducing myself and my classmates
4. Describing people, school places, and familiar objects
5. Daily routines, preferences, and simple exchanges
6. Instructions, short messages, and final mini project

Total estimated time: 260 minutes.

## Materials And Interactive Content

| Material | Kind | Purpose |
|---|---|---|
| Grade 7 English diagnostic speaking cards | Interactive | Baseline speaking prompts for classroom language and introductions. |
| Classroom language listening sprint | Audio | Listen-and-match activity for teacher instructions and learner responses. |
| Personal profile builder | H5P | Guided writing flow for profile creation and peer interview. |
| Descriptive text reading pack | Document | Reading pack for topic, details, adjectives, and purpose. |
| Procedure sequencer interactive | H5P | Drag-order, verb-choice, and connector gap-fill blueprint. |
| Grade 7 English presentation rubric | Template | Teacher and peer feedback rubric for final mini project. |

## Verification Routes

- Content Manager: `/content/library`
- Learner catalog: `/dashboard/courses?search=English`
- Course detail: `/dashboard/courses/70707070-1111-4111-8111-707070707001`

## Seed Command

```bash
npm run db:seed
```

## Demo School Learner Credential

Use this account to test the global English Grade 7 course as a learner inside a school tenant that adopts platform global content.

| Context | Value |
|---|---|
| School | SMP Global Merdeka Demo |
| Learner | Nadia Putri - Grade 7 Learner |
| Email | `nadia.grade7@oetakstudio.local` |
| Password | `English@2026!` |
| Organization role | `student` |
| Assigned course | `Kurikulum Merdeka English Grade 7: Pathway Foundations` |
| Course route | `/dashboard/courses/70707070-1111-4111-8111-707070707001` |

Supporting demo school accounts use the same password:

| Role | Email | Password |
|---|---|---|
| School Tenant Owner | `owner.smp-global@oetakstudio.local` | `English@2026!` |
| School Admin | `admin.smp-global@oetakstudio.local` | `English@2026!` |
| English Teacher | `teacher.hana@oetakstudio.local` | `English@2026!` |
