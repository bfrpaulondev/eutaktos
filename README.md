# EUTAKTOS

> **Everything in good order.**

Eutaktos is an independent, privacy-first congregation management platform being designed to make congregation administration simpler, fairer, safer and more intuitive.

It combines the broad operational capabilities expected from mature congregation-management tools with new capabilities such as explainable Smart Assign, Smart Replacement, fairness/underuse insights, a permission-scoped AI assistant, WhatsApp-oriented communication workflows, a restricted Review Center and deep user personalization.

**Eutaktos is intended to remain free to use.** There are no planned subscriptions, premium feature tiers, advertisements or sale of personal data. Project/infrastructure costs may be supported only through **voluntary donations**, completely separated from access, permissions, eligibility and functionality.

> [!IMPORTANT]
> **Independent project / working name.** Eutaktos is not affiliated with, sponsored by or endorsed by Watch Tower Bible and Tract Society, JW.ORG, Hourglass, New World Scheduler / NW Publisher or their developers. Third-party names are used only to describe clean-room interoperability and publicly documented capability-parity goals. Formal trademark clearance remains a Phase 0 prerequisite before public release under this name.

## Product promise

Eutaktos should help responsible brothers spend less time manually searching through history and more time making informed human decisions.

The system may **calculate, detect, explain and recommend**. It must never decide spiritual qualification.

Privileges and eligibility are explicitly configured by authorized brothers. AI may use objective operational facts such as availability, assignment history, recency and configured eligibility, but it may not infer spirituality or qualification from attendance, field-service activity, messages, personality, health, family circumstances or hidden behavioral scores.

## PWA first: web, Android and iPhone from one product

The initial canonical client is a **Progressive Web App (PWA)**.

It must:

- work as a normal secure website;
- be installable to the home screen on supported Android, iPhone and iPad browsers;
- provide the same permission-driven capability set across phone, tablet and desktop;
- be fully responsive from narrow phones through large desktops;
- remain usable without installation;
- be mobile-first without becoming mobile-only;
- handle poor connectivity gracefully;
- use conservative, threat-modeled offline caching because the data is sensitive;
- safely handle PWA/service-worker upgrades and stale clients;
- support push where available, with in-app/email/WhatsApp-oriented fallback strategies;
- remain fast and comfortable on ordinary and older devices.

Dedicated native applications are deferred unless a future platform requirement genuinely justifies the additional security, accessibility and maintenance surface.

See [`docs/UX-ACCESSIBILITY.md`](docs/UX-ACCESSIBILITY.md) and [`docs/adr/0004-pwa-first-accessible-client.md`](docs/adr/0004-pwa-first-accessible-client.md).

## Accessibility and personalization are release requirements

Eutaktos is intended for users with very different ages, devices, languages, abilities and levels of technical confidence.

The release floor is **WCAG 2.2 Level AA**, with relevant AAA success criteria adopted where practical. Shared components must be designed for keyboard operation, visible focus, screen readers, text enlargement/reflow, reduced motion, high contrast and touch accessibility.

Manual accessibility testing includes VoiceOver, TalkBack, keyboard-only use, zoom/reflow and long translated content. A critical accessibility regression can block a release.

Every user can have personal preferences independent of the congregation defaults, including:

- application language;
- locale/date/number formatting;
- light, dark or system theme;
- accessible accent color;
- text size;
- readable-font option;
- high-contrast mode;
- reduced motion;
- compact or comfortable density.

Custom theme choices are constrained by accessible design tokens so personalization cannot create an unreadable interface.

## Multilingual by architecture

The application must not assume Portuguese or any other single language.

The architecture includes:

- per-user UI language independent from the congregation language;
- explicit congregation timezone;
- locale-aware dates, times and numbers;
- plural/grammar-aware message formatting;
- long-text and pseudo-localization testing;
- RTL-ready layout primitives;
- localized notification/message templates;
- translation fallback/version handling.

## Planned capability coverage

The canonical scope is maintained in [`docs/FEATURES.md`](docs/FEATURES.md). The goal is functional breadth comparable to the publicly documented capabilities of Hourglass and New World Scheduler / NW Publisher, plus Eutaktos-specific improvements.

Major domains include:

- congregation profile, people, families, groups and emergency contacts;
- privileges/eligibility configured by authorized roles;
- absences and availability;
- midweek/Life and Ministry scheduling and history;
- weekend meetings and public talks;
- local/away speakers, outlines, hospitality and sharing;
- audio, video, microphones, platform, attendants, security and custom duties;
- field-service groups and meetings;
- public witnessing locations/shifts/reservations;
- territories, maps, addresses, campaigns and assignment history;
- secretary/reporting workflows and service-year views;
- cleaning, gardens, maintenance and recurring tasks;
- literature requests;
- events, announcements and information board;
- Circuit Overseer visit and custom schedules;
- publisher dashboard, confirmations, reports and away periods;
- push, email and planned WhatsApp Business Platform communication;
- import/export, encrypted backup and migration tools;
- Smart Assign, Smart Replacement and fairness insights;
- permission-scoped Congregation Assistant;
- restricted Review Center.

## Smart Assign

Smart Assign is deterministic first and AI-assisted second.

The scheduling engine may consider:

- configured eligibility;
- availability/absence;
- time since the last equivalent assignment;
- number of assignments over configurable windows;
- same-week workload;
- minimum spacing and maximum frequency rules;
- pairing/assistant considerations where relevant;
- cross-schedule conflicts;
- underuse/overuse indicators;
- locally configured scheduling preferences.

Hard eligibility and conflict rules cannot be overridden by an LLM.

Example explanation:

> Carlos is recommended because he is eligible and available, has no other assignment that week, and has gone 126 days since his last Bible reading. Other eligible candidates were used more recently.

## Smart Replacement

When a person declines or becomes unavailable, Eutaktos can:

1. detect the open assignment;
2. calculate valid substitutes;
3. rank them using transparent reasons;
4. show conflicts and recent usage;
5. let the responsible brother choose;
6. notify the selected person;
7. preserve the complete history and audit trail.

## Fairness / usage insights

The system can show objective scheduling information such as:

- people who have gone longest without an eligible assignment;
- people apparently underused relative to other eligible peers;
- people being scheduled significantly more often;
- 30/60/90/180-day and service-year views.

These are operational scheduling metrics, **not spiritual scores**.

## Review Center

Review Center exists to prevent important human reviews from being forgotten.

A congregation may configure an objective trigger such as:

- already eligible for local public talks;
- at least a configured number of talks completed;
- a configured period since eligibility;
- no recent review recorded.

The result is only a prompt such as **“this brother may be due for review.”** Authorized reviewers then evaluate the actual situation. The software does not grant, revoke or conclude spiritual qualification.

Restricted Review Center information receives narrower authorization, stronger audit requirements and a separate encryption scope.

## Congregation Assistant

Natural-language examples:

- “Who has gone the longest without a Bible reading?”
- “Prepare a balanced September draft.”
- “Carlos will be away from 12 to 21 September.”
- “Replace André with Carlos on microphone next Tuesday.”
- “What is still missing for this week's meeting?”

AI actions are permission-scoped. Writes require a structured preview, validation and explicit human confirmation.

See [`docs/AI-SAFETY.md`](docs/AI-SAFETY.md).

## Communication

Planned channels:

- in-app/push notifications;
- email;
- WhatsApp Business Platform where configured and legally appropriate;
- important/emergency notices;
- acknowledgements/read state where supported;
- per-person channel preference;
- localized templates.

A privacy-minimized WhatsApp mode may send only a generic message such as **“You have a new assignment. Open Eutaktos to view it.”** rather than exposing the assignment itself to a third-party messaging platform.

## Import, export and migration

Migration is a first-class capability.

Planned imports, subject to clean-room/legal/format review, include:

- user-generated Hourglass exports;
- documented New World Scheduler/CSV pathways;
- CSV/JSON;
- KML/GeoJSON for territories;
- selected legacy formats where lawful and practical.

Planned exports include:

- canonical JSON;
- CSV by domain;
- PDF reports;
- DOCX where useful;
- GeoJSON/KML;
- portable encrypted Eutaktos backup.

Imports must support preview/dry-run, validation, conflict reporting, logs and rollback. External formats map through a versioned canonical migration model rather than directly into core production tables.

See [`docs/IMPORT-EXPORT.md`](docs/IMPORT-EXPORT.md).

## Security and data protection

Eutaktos can process information that reveals religious affiliation. Security and privacy are therefore release-blocking requirements.

Planned controls include:

- EU-region hosting by default for EU deployments;
- strict tenant/congregation isolation;
- server-side authorization on every sensitive operation;
- encryption in transit and at rest;
- stronger field/envelope encryption for selected sensitive data;
- separate encryption context for restricted review notes;
- passkeys/WebAuthn and MFA, with strong-authentication requirements for privileged roles;
- session/device inventory and revocation;
- least-privilege RBAC/contextual authorization;
- append-only/tamper-evident audit events;
- no production data in lower environments;
- KMS/secret-store management;
- data minimization and retention policies;
- audited/throttled exports;
- subprocessor/DPA governance;
- DPIA before production launch;
- backup/restore and disaster-recovery drills;
- SAST, dependency/SBOM scanning, secret scanning, DAST, fuzzing and external penetration testing before GA.

See [`SECURITY.md`](SECURITY.md), [`docs/SECURITY-ARCHITECTURE.md`](docs/SECURITY-ARCHITECTURE.md), [`docs/DATA-PROTECTION.md`](docs/DATA-PROTECTION.md) and [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md).

## Engineering direction

Exact providers are intentionally not locked until privacy, residency, security and cost review. The current direction is:

```text
apps/
  web-pwa/      # canonical responsive installable PWA
  api/          # authenticated application API
  worker/       # notifications, imports, exports, scheduled jobs

packages/
  domain/
  scheduler/
  permissions/
  ai/
  import-export/
  contracts/
  i18n/
  ui/
  observability/

infra/
docs/
```

Candidate direction: TypeScript end-to-end, React-based PWA, strongly typed API, PostgreSQL as canonical relational storage, worker queues for asynchronous work, private object storage for documents and infrastructure as code.

## Professional delivery model

Development is gated end-to-end:

1. **Governance/legal/risk** — trademark/domain, license, controller/processor model, DPIA draft, threat model, donation governance.
2. **Platform foundation** — PWA shell, CI/CD, auth, tenant isolation, authorization, audit, i18n, themes, accessible design system.
3. **Core data + migration** — people/groups/eligibility/availability and import/export framework.
4. **Scheduling core** — midweek, weekend/public talks and duties.
5. **Publisher PWA + communication** — dashboard, confirmations, offline resilience, notifications, email.
6. **Secretary/service/territories**.
7. **Extended parity** — cleaning, maintenance, literature, information board, events, CO visit and related workflows.
8. **Intelligence** — Smart Assign, replacement, fairness and assistant.
9. **Review Center**.
10. **Pre-production hardening** — external pen test, DPIA completion, DR, load testing, accessibility audit and migration rehearsals.
11. **Pilot and controlled GA**.

See [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ENGINEERING-PLAN.md`](docs/ENGINEERING-PLAN.md) and [`docs/BACKLOG.md`](docs/BACKLOG.md).

## Testing and quality gates

Planned test layers include:

- unit tests;
- property-based scheduler tests;
- integration tests against real ephemeral infrastructure where practical;
- API/event contract tests;
- E2E PWA tests by role;
- Android/iPhone/iPad/desktop browser matrix;
- migration golden/round-trip/security tests;
- authorization/tenant-isolation tests;
- accessibility automation plus manual assistive-technology testing;
- localization, text-expansion, timezone and RTL-readiness tests;
- performance/load/soak tests;
- resilience and backup-restore drills;
- security regression and external penetration testing.

No release with a known exploitable critical/high security defect, cross-tenant data issue, broken critical E2E flow, critical WCAG 2.2 AA regression or unsafe PWA offline/update behavior.

See [`docs/TESTING-QUALITY.md`](docs/TESTING-QUALITY.md).

## Donation model

If donations are enabled, they will be:

- voluntary;
- unrelated to features or limits;
- unrelated to congregation size;
- processed separately from congregation records;
- never used as an individual profile/eligibility signal;
- transparent about supporting infrastructure and project sustainability.

See [`DONATIONS.md`](DONATIONS.md).

## Status

**Planning / engineering foundation. No production release exists yet.**

The first objective is to establish the privacy, security, accessibility, migration and architecture foundations correctly before implementing sensitive production workflows.

## Public capability references

Initial parity planning uses public product documentation, including:

- Hourglass: https://www.hourglass-app.com/en/features/
- New World Scheduler: https://nwscheduler.com/features/
- NW Publisher: https://nwscheduler.com/jw-scheduler-publisher-edition-app/
- NW Scheduler support/import documentation: https://nwscheduler.com/support/

These references do not imply affiliation.

## Contributing

The repository is public during planning/foundation. External production-code contribution rules and the software license must be finalized during Phase 0 before production code contributions are accepted.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).
