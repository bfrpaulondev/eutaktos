# Roadmap

The roadmap is intentionally gated. A later phase does not start merely because a date arrives; the previous phase must meet its Definition of Done.

## Phase 0 — Governance, legal and risk foundation

Deliverables:
- formal trademark/domain clearance;
- project license decision;
- controller/processor operating model;
- first DPIA draft;
- data inventory and processing register;
- threat model;
- subprocessor policy;
- security disclosure process;
- donation governance policy;
- architecture decision records.

Exit gate: no unresolved critical legal/security architecture question that would force a data-model rewrite.

## Phase 1 — Engineering foundation

Deliverables:
- monorepo and coding standards;
- dev/staging/prod separation;
- CI quality gates;
- authentication and session management;
- tenant isolation;
- authorization framework;
- audit events;
- installable PWA shell and service-worker safety policy;
- mobile-first responsive application shell;
- i18n foundation with per-user language;
- theme/token system with per-user appearance preferences;
- accessible design system and WCAG 2.2 AA baseline;
- keyboard/focus/screen-reader behavior for shared components;
- observability with PII redaction.

Exit gate: authorization and tenant-isolation automated tests pass; threat-model controls mapped; the PWA installs/runs on target Android/iPhone/desktop environments; the application shell and shared components meet the accessibility baseline.

## Phase 2 — Core data + migration foundation

Deliverables:
- congregation/person/family/group models;
- roles/responsibilities/eligibility;
- away periods;
- emergency contacts;
- import/export framework;
- CSV + Eutaktos portable export;
- Hourglass clean-room fixture research using user-provided exports;
- migration preview/log/rollback.

Exit gate: round-trip exports reproduce equivalent canonical data; no cross-tenant access possible in tests.

## Phase 3 — Scheduling core

Deliverables:
- midweek/Life and Ministry;
- auxiliary classes;
- weekend/public talks;
- duties;
- public speakers/congregations/outlines/history;
- conflict engine;
- printable schedules.

Exit gate: full scheduling E2E suite; schedule history cannot be silently overwritten.

## Phase 4 — Publisher-focused PWA + communication

Deliverables:
- personal dashboard optimized for one-handed mobile use without losing desktop capability;
- assignment confirm/decline/acknowledge;
- push notifications;
- channel preferences;
- personalized language/theme/accessibility;
- safe offline read cache for low-connectivity cases;
- guarded/idempotent offline queue only for explicitly approved workflows;
- PWA update/recovery experience;
- email integration.

Exit gate: Android/iPhone/desktop PWA E2E passes; WCAG 2.2 AA critical-path audit passes; offline/update tests pass; revoked access invalidates sessions and protected local cache correctly.

## Phase 5 — Secretary, service and territories

Deliverables:
- field-service activity/reporting;
- attendance;
- publisher records and operational reports;
- service-year views;
- field-service schedules/groups;
- public witnessing;
- territories/maps/addresses/assignments/campaigns.

Exit gate: reporting correctness verified against golden fixtures; map permissions tested.

## Phase 6 — Extended parity

Deliverables:
- cleaning/gardens;
- maintenance/LDC-style tasks;
- literature requests;
- congregation events;
- information board;
- custom schedules;
- Memorial;
- Circuit Overseer visit planning;
- hospitality requests;
- public-speaker sharing.

Exit gate: feature registry `P2` parity items substantially complete.

## Phase 7 — Eutaktos intelligence

Deliverables:
- Smart Assign deterministic engine;
- fairness dashboard;
- Smart Replacement;
- “prepare next meeting” validator;
- natural-language read assistant;
- structured write previews;
- AI redaction/pseudonymization gateway.

Exit gate: scheduler invariants proven through property tests; AI cannot bypass authorization or change spiritual eligibility.

## Phase 8 — Review Center

Deliverables:
- configurable objective review triggers;
- restricted reviewer workflow;
- separate encrypted notes;
- defer/review-later;
- human approval/rejection state;
- immutable history.

Exit gate: privacy/legal review completed; sensitive-access audit tested; no automated final decision path exists.

## Phase 9 — Pre-production hardening

Deliverables:
- external penetration test;
- remediation of critical/high findings;
- DPIA finalization;
- DPA/subprocessor documents;
- backup restore exercise;
- disaster recovery exercise;
- load/soak tests;
- full accessibility audit;
- migration rehearsals using anonymized/authorized samples;
- incident tabletop exercise.

Exit gate: production-readiness review signed off.

## Phase 10 — Pilot and general availability

Pilot:
- small, opt-in congregation cohort;
- no production-data copying into support systems;
- explicit feedback channel;
- incident/error budget tracking;
- migration support.

General availability only after pilot objectives and security/privacy gates are met.
