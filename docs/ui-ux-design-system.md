# Oetak Studio UI/UX Design System

> **Status:** Canonical visual implementation guidance  
> **Scope:** Web UI, responsive UI, product illustrations, generated visual assets, and AI-assisted UI implementation.  
> **Authority:** Product/domain behavior remains governed by `app_summary.md`. Coding-agent behavior remains governed by `AGENTS.md`. If this document conflicts with a canonical rule in `app_summary.md`, `app_summary.md` wins.

---

## 1. Design Principles

Oetak Studio should feel:

- calm, trustworthy, educational, and modern;
- AI-native without looking like a generic chatbot product;
- approachable for learners while remaining professional for educators and organizations;
- content-first, readable, and low in cognitive load;
- consistent across learner, teacher, creator, guardian, organization, and platform-admin surfaces.

Avoid visual complexity that does not improve comprehension or task completion.

---

## 2. Canonical Brand Colors

The canonical Oetak Studio application theme is:

- **Primary:** `#274029` — Deep Islamic Green
- **Secondary:** `#624F8C` — Royal Purple

### Primary usage

Use Deep Islamic Green for:

- primary calls to action;
- active navigation and selected states;
- primary brand elements;
- high-confidence completion/success emphasis where semantically appropriate.

### Secondary usage

Use Royal Purple for:

- secondary emphasis;
- AI-related accents and surfaces;
- complementary interactive states;
- supporting illustrations and visual hierarchy.

### Important rules

- Do not replace the canonical brand palette with arbitrary blue, indigo, cyan, or generic SaaS palettes.
- Do not hardcode brand hex values throughout components. Expose them as semantic design tokens and consume those tokens in components.
- Derived tints/shades of the primary and secondary colors are allowed for hover, pressed, subtle backgrounds, borders, charts, and dark/light modes.
- Semantic state colors such as error, warning, success, and information remain separate from brand colors when needed for clarity and accessibility.
- Color usage must preserve WCAG 2.2 AA contrast requirements defined in `app_summary.md` §19.1.

Suggested token intent:

```text
brand.primary       = #274029
brand.secondary     = #624F8C

semantic.background
semantic.surface
semantic.border
semantic.text.primary
semantic.text.secondary
semantic.success
semantic.warning
semantic.error
semantic.info

product.learning
product.mastery
product.assessment
product.ai
```

Implementation should map these semantics to CSS variables/Tailwind tokens rather than scattering raw color literals across the codebase.

---

## 3. Typography

Typography must prioritize readability for long-form learning content and dense educator/admin interfaces.

Requirements:

- use a clear sans-serif UI typeface unless a later brand decision supersedes it;
- maintain a predictable heading hierarchy;
- use comfortable line-height for lesson content;
- avoid excessive uppercase text;
- avoid overly decorative fonts in core learning or assessment flows;
- support both English and Bahasa Indonesia without layout breakage.

---

## 4. Spacing, Radius, and Elevation

Use a consistent spacing scale and avoid one-off pixel values when an existing token is suitable.

Preferred visual character:

- moderate border radius rather than extreme pill-shaped containers everywhere;
- subtle borders and restrained shadows;
- clear grouping through spacing before relying on heavy cards;
- limited elevation layers so hierarchy remains understandable.

---

## 5. Navigation and Application Shell

Oetak Studio uses one application shell whose navigation changes according to active workspace, permissions, and resource relationships.

Do not create isolated products for every role when the same user may hold multiple roles in one workspace.

Navigation should remain:

- workspace-aware;
- permission-aware;
- responsive;
- keyboard accessible;
- consistent between learner and educator contexts while allowing role-specific modules.

The active workspace must remain visually discoverable because Workspace is the canonical security and business-data boundary.

---

## 6. Learner Experience

Learner UI should emphasize:

- the next useful learning action;
- current course and resume position;
- completion and mastery as distinct concepts;
- upcoming assessments;
- contextual AI Tutor access;
- clear recovery/degraded states when AI is unavailable.

Avoid dashboards dominated by administrative metrics.

A learner should quickly understand:

> What am I learning now, how am I progressing, and what should I do next?

---

## 7. Teacher and Educator Experience

Teacher/educator UI should emphasize:

- learners who need attention;
- completion and mastery gaps;
- assessment outcomes;
- course/offering context;
- intervention actions;
- data freshness where analytics are cached.

A teacher should quickly understand:

> Who needs help, with what, and what action can I take?

---

## 8. Creator / Course Builder Experience

Course authoring should separate:

```text
Course structure
+ editor/work area
+ contextual AI assistance
+ validation/publish readiness
```

AI-generated educational material must visibly remain draft/reviewable until accepted or edited by a human.

Published-version immutability and validation failures must be represented explicitly in the UI rather than hidden behind generic errors.

---

## 9. AI Surfaces

AI should appear as a contextual capability inside the product workflow, not as a disconnected generic chat application.

AI surfaces should:

- show the relevant course/unit/workspace context;
- expose retry/degraded/unavailable states;
- distinguish generated suggestions from authoritative product/domain state;
- use the secondary Royal Purple family as the preferred accent when an AI-specific visual distinction is useful;
- never imply that an LLM-generated confidence value is authoritative.

---

## 10. Human Character and Illustration Guidelines

These rules apply whenever Oetak Studio itself designs, commissions, or AI-generates a **human character or human illustration** for product UI, onboarding, empty states, marketing visuals, educational illustrations, thumbnails, or other generated visual assets.

They do not redefine the product's user-upload policy for personal profile photographs unless a separate policy explicitly does so.

### 10.1 General

Any depicted human character must use a respectful **faceless Muslim illustration style**.

Requirements:

- do not render detailed facial features such as eyes, nose, or mouth;
- clothing must be modest and non-revealing;
- avoid tight-fitting or body-emphasizing silhouettes;
- avoid sexualized poses, styling, or framing;
- poses should be natural, respectful, and appropriate for an educational product.

### 10.2 Male Characters

Male characters must use:

- modest, reasonably loose clothing;
- trousers whose hem remains **above the ankles (non-isbal)**;
- no detailed facial features.

Avoid:

- trousers extending below the ankles;
- tight-fitting clothing;
- body-emphasizing styling.

### 10.3 Female Characters

Female characters must use:

- a **long hijab** covering the hair, neck, and chest;
- loose, modest clothing;
- no detailed facial features.

Avoid:

- exposed hair or neck;
- short hijab that does not cover the chest;
- tight-fitting or body-emphasizing clothing.

### 10.4 Consistency

These character rules apply equally to:

- manually created illustrations;
- stock-style illustrations commissioned for the product;
- AI-generated images;
- AI-generated SVG/vector-style assets;
- image prompts produced by coding or design agents.

If a visual concept cannot satisfy these requirements reliably, prefer a non-human illustration, iconography, abstract geometry, product UI mockup, object, landscape, or other suitable visual treatment.

---

## 11. Canonical AI Image Prompt Fragment

When an AI agent generates an image prompt containing people, include the following constraints or an equivalent formulation:

```text
Oetak Studio human character guidelines:

Use a respectful faceless Muslim illustration style.
Do not draw detailed facial features such as eyes, nose, or mouth.

Male characters:
- modest loose clothing
- trousers above the ankles (non-isbal)
- no detailed facial features

Female characters:
- long loose hijab covering hair, neck, and chest
- modest loose clothing
- no detailed facial features

Oetak Studio brand identity:
- Deep Islamic Green #274029
- Royal Purple #624F8C

Avoid:
- visible facial features
- short hijab
- tight or body-emphasizing clothing
- exposed hair or neck for female characters
- male trousers extending below the ankles
- sexualized poses or styling
- arbitrary generic blue SaaS branding
```

The exact wording may change to fit the image model, but the constraints must not be weakened.

---

## 12. Responsive Design

The application is responsive/mobile-first as required by `app_summary.md` §19.3.

At minimum, designs must account for:

- mobile;
- tablet;
- desktop;
- narrow/zoomed accessibility layouts.

Do not simply shrink desktop dashboards onto mobile. Re-prioritize information and actions for the smaller viewport.

---

## 13. Accessibility

All components must follow the WCAG 2.2 AA target in `app_summary.md` §19.1.

At minimum:

- semantic HTML;
- keyboard operability;
- visible focus indicators;
- sufficient text/control contrast;
- accessible form labels and validation;
- non-color-only status communication;
- adequate touch targets;
- reduced-motion support;
- captions/transcripts where relevant.

Brand identity must never override accessibility.

---

## 14. Component Reuse

Before building a new component, inspect existing primitives and product components.

Prefer a layered system:

```text
Design tokens
    ↓
UI primitives
    ↓
Product components
    ↓
Feature/page composition
```

Examples of product-level components include:

- `WorkspaceSwitcher`
- `CourseCard`
- `LearningTrackCard`
- `MasteryIndicator`
- `ProgressIndicator`
- `AssessmentCard`
- `LearningObjectiveBadge`
- `LessonNavigator`
- `AIMessage`
- `AIAction`
- `PublishReadinessPanel`

Do not duplicate a product component merely to create a slightly different page aesthetic.

---

## 15. UX States

Every meaningful asynchronous or data-dependent experience must account for the canonical states already required by `app_summary.md` §5.8:

- loading;
- empty;
- success;
- recoverable error;
- permission denied;
- degraded;
- restricted;
- retry where safe.

Skeletons, progress indicators, and error messages should preserve layout stability and explain the user's next available action.

---

## 16. Do / Don't Summary

### Do

- use Deep Islamic Green and Royal Purple as the canonical brand foundation;
- reuse semantic design tokens;
- keep learner flows focused and calm;
- keep educator interfaces efficient without unnecessary density;
- distinguish completion from mastery;
- make AI contextual and visibly non-authoritative where appropriate;
- use faceless, modest Muslim characters whenever human illustrations are used;
- design mobile experiences intentionally.

### Don't

- introduce a generic blue SaaS identity;
- scatter raw brand hex values through components;
- make every surface look like a chatbot;
- use role visibility as a substitute for authorization;
- hide important AI degradation or permission states;
- use human illustrations with detailed faces;
- depict male characters with trousers below the ankles;
- depict female characters with short hijab, exposed hair/neck, or tight clothing;
- sacrifice accessibility for branding.
