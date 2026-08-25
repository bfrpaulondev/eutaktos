# Eutaktos Product Experience — Current Inventory

> Principal inventory for PX0.5/PX0.6.
>
> Snapshot base: `main` `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` (2026-08-25).
> Active product source of truth: `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`.
> Canonical production: `https://eutakes.netlify.app/`.

This document records what already exists so Product Experience work can reuse the current technical foundation instead of rebuilding working behavior or accidentally creating a second source of truth.

## 1. Active coordination

- Product Experience coordination: GitHub issue #268.
- PX1 Ant foundation was integrated in PR #283.
- PX2 task-oriented shell was integrated in PR #291.
- People Overview first slice was integrated after principal correction in PR #289.
- Secure administrator AI core was integrated in PR #288; AI remains advisory/read-only and PX7 remains authoritative for recommendation facts.
- Historical pilot queues and acceptance documents are evidence only. They do not override the Product Experience master plan.

## 2. Ant/MUI migration boundary

Ant Design 6 is the primary component system for every newly rebuilt Product Experience surface.

The current application is intentionally transitional. The Ant foundation and task-oriented shell are integrated, while legacy runtime screens continue to use MUI until their own migration slice is reviewed and accepted.

### Current MUI runtime consumers identified in the frontend

The indexed source inventory plus the current PX2 shell shows these migration consumers/boundaries:

- `apps/web-pwa/src/App.tsx` — legacy MUI theme bridge around the incremental migration.
- `apps/web-pwa/src/TaskShell.tsx` — Ant shell with temporary MUI content/preferences compatibility sections.
- `apps/web-pwa/src/SectionWorkspace.tsx` — legacy workspace boundary.
- `apps/web-pwa/src/ui/MuiCompat.tsx` — compatibility helpers.
- `apps/web-pwa/src/theme.ts` — legacy MUI theme retained while consumers remain.
- `apps/web-pwa/src/LogoutControl.tsx`.
- `apps/web-pwa/src/PwaConnectionStatus.tsx`.
- `apps/web-pwa/src/PwaUpdateRecovery.tsx`.
- `apps/web-pwa/src/MagicLinkConfirmationPanel.tsx`.
- `apps/web-pwa/src/AuthSignInPanel.tsx`.
- `apps/web-pwa/src/ProductionDashboard.tsx`.
- `apps/web-pwa/src/MidweekWorkspace.tsx`.
- `apps/web-pwa/src/MidweekAuthoringControls.tsx`.
- `apps/web-pwa/src/EligibilityDialog.tsx`.
- `apps/web-pwa/src/PeopleDirectory.tsx`.
- `apps/web-pwa/src/HouseholdsSection.tsx`.
- `apps/web-pwa/src/ServiceGroupsSection.tsx`.
- `apps/web-pwa/src/ResponsibilitiesSection.tsx`.
- `apps/web-pwa/src/AwayPeriodsSection.tsx`.
- `apps/web-pwa/src/EmergencyContactsDialog.tsx`.
- `apps/web-pwa/src/AuditHistoryDialog.tsx`.
- `apps/web-pwa/src/AccessManagementDialog.tsx`.
- `apps/web-pwa/src/HourglassImportInspector.tsx`.
- `apps/web-pwa/src/CongregationSettingsDialog.tsx`.

This is a migration inventory, not permission to extend those screens with new MUI Product Experience UI.

### Migration rule

1. Do not add a new Product Experience screen in MUI.
2. Do not replace working legacy behavior merely to reduce the import count.
3. Rebuild a coherent user workflow in Ant, prove it, then retire the old consumer.
4. `@mui/material` and Emotion are removed only after the final runtime consumer is gone and quality/browser/PWA/bundle gates pass.
5. Avoid mixing Ant and MUI within a newly rebuilt screen except at a documented compatibility boundary.

## 3. People frontend/API capability inventory

### People core

Current `peopleApi` exposes:

- list people;
- create person;
- update person;
- fields currently exposed to the PWA: `id`, `displayName`, optional `preferredLocale`, `active`.

Important Product Experience consequence: the current People DTO does **not** expose a complete unified profile contract for ordinary phone/email/address, group, household, responsibility, availability summary or assignment history. New People 2.0 screens must not invent those fields.

### Availability / away periods

Current `availabilityApi` exposes per-person:

- list periods;
- add a period;
- remove a period;
- explicit `startsAt`, `endsAt`, optional `reasonCode` (`away`, `unavailable`, `other`).

Any period covering the relevant time is operational unavailability; `reasonCode` is descriptive and must not be reinterpreted as permission to ignore a period.

### Eligibility

Current `eligibilityApi` exposes per-person:

- list explicit assignment-type decisions;
- set `assignmentTypeId` + `enabled`;
- `decidedAt` evidence.

Missing eligibility data must never be treated as positive eligibility.

### Households

Current `householdsApi` exposes:

- list/get/create/update/delete;
- `id`, `name`, `memberIds`.

This behavior should be reused in the unified Organization/profile experience instead of replaced with a second household model.

### Service groups

Current `serviceGroupsApi` exposes:

- list/get/create/update/delete;
- `id`, `name`, `memberIds`, optional `overseerId`, optional `assistantId`.

This is sufficient to derive group membership/context after authorized reads, but the base `PersonProfileDto` itself does not include group information.

### Responsibilities

Current `responsibilitiesApi` exposes:

- list/get assignments;
- assign responsibility;
- end responsibility;
- `personId`, `responsibilityKey`, `startsAt`, optional `endsAt`.

The unified person profile should compose this existing data rather than introduce a parallel responsibility store.

### Emergency contacts

Current `emergencyContactsApi` exposes per-person:

- list/create/update/delete;
- `name`, `phone`, optional `relationship`.

This is sensitive data and belongs behind least-privilege capability-aware UI. It must not become a default directory payload or AI context field.

### Midweek meetings and assignments

Current `midweekApi` exposes:

- overview of meetings, slots, student assignments and non-student assignments;
- meeting date/local time/timezone/state;
- assignment state: `assigned`, `cancelled`, `completed`;
- meeting/slot creation and editing operations;
- assignment, replacement and cancellation operations.

This supplies real current assignment evidence and completed-state data, but the frontend does not yet have a purpose-built per-person assignment-history/query contract for People Profile or recommendation UX.

### Audit/access/configuration

Existing frontend boundaries also cover:

- audit history;
- access grants/capabilities;
- congregation settings/timezone;
- assignment type catalogue;
- Hourglass import inspection.

Reuse these boundaries where they are authoritative. Do not duplicate authorization or audit decisions in browser-only state.

## 4. People target gaps that still need contracts or composition

The following Product Experience requirements are not fully available from the base People DTO alone and must be solved truthfully before UI claims them:

| Target capability | Current status | Required next action |
| --- | --- | --- |
| Rich unified person summary | Partial | Compose authorized People + group + household + responsibilities + availability + assignment evidence, preferably through focused application/API contracts where repeated fan-out would be excessive. |
| Ordinary contacts (phone/email/address) | Not exposed by current People DTO | Confirm existing domain/persistence capability or define a reviewed contract before building PX5 Contacts. |
| Profile completeness | No explicit required-field contract | Define which fields are actually required before enabling PX3.4. |
| Group count/row context | Data exists via service groups | Compose from real service-group membership; do not add fake People fields. |
| Availability summary/next absence | Data exists per person | Build an authorized summary/query suited to directory/profile use rather than uncontrolled N+1 requests. |
| Eligibility summary/filter | Data exists per person | Build a query/composition path appropriate for directory/profile and keep missing decision semantics explicit. |
| Responsibility summary/filter | Data exists globally | Compose current assignments into person context. |
| Person assignment history | Partial via midweek overview | Add/reuse a focused completed/upcoming-history query before PX5/PX7 depends on it broadly. |
| Recent availability changes | No canonical history/event query in current PWA contract | Keep PX3.7 omitted until reliable history exists. |
| Long-interval recommendation insight | Requires deterministic recommendation/history contract | Use PX7; do not implement ranking independently in frontend. |
| Transfers | Not present as a complete People Product Experience contract | PX9 design/API work. |
| Labels/tags | Not present as a complete People Product Experience contract | PX9. |
| Reminders | Not present as a complete People Product Experience contract | PX9. |
| Archive / do-not-publish | Not present as a complete People Product Experience contract | PX9. |
| Record cards/reports | Not present as a complete People Product Experience contract | PX9. |
| People map | Not present as a permissioned People Product Experience contract | PX9 with privacy/precision review. |
| CSV/PDF export | Not part of the current base People API | PX9 with minimum-data/audit review. |

## 5. Recommendation and AI boundary

- PX7 is the deterministic source for candidate ranking/reasons.
- Hard constraints remain explicit eligibility, away periods and conflicts.
- Recency uses completed assignments only.
- Same-week workload may influence ordering but cannot override hard constraints.
- AI may explain authorized evidence and PX7 output; it must not invent or override recommendation facts.
- Dynamic congregation data is retrieved through narrow server-side tools, never direct model database access.

## 6. Immediate handoff to the next wave

Wave A foundation is now technically integrated. The next Product Experience work should therefore focus on Wave B without reopening the shell architecture:

1. PX4 Directory 2.0 using real composable People/organization data.
2. PX5 Unified Person Profile, adding backend/API contracts only where the inventory proves they are missing.
3. PX6 Guided Add/Edit, preserving server authority and persistence.
4. PX7 may proceed in parallel at domain/application level and later feed PX8/AI.

Do not broaden into PX9 parity or general MUI retirement before the People reference workflow proves these patterns.
