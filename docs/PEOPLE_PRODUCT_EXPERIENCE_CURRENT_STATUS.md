# People Product Experience — current integrated status

> Principal status snapshot updated 2026-08-27 after PX7.8 manual exclusions, the authenticated Hourglass execute/rollback flow and configurable Contact List integration. This file records what is actually present on `main`; it does not turn deferred real-user production acceptance into automated evidence.

## Current baseline

- Repository: `bfrpaulondev/eutaktos`
- Canonical production: `https://eutakes.netlify.app/`
- Current technical People/PX baseline: `c407c9a5db653f15f619d652eba120d94858e50f`.
- UI foundation: Ant Design 6. Runtime MUI/Emotion dependencies have been retired and guarded from reintroduction.
- Tenant, actor and capabilities remain server-derived. Client state is never authoritative for those values.

## Integrated People Product Experience

### PX5 — Unified Person Profile

Technically implemented on `main`:

- ordinary phone/email/address Contact resource and edit flow through the canonical dedicated GET/PUT contract;
- local validation, fail-closed 401/403 behavior, duplicate-save protection and authoritative refetch;
- no ordinary-contact PII in URL, browser storage, service-worker cache, audit/event values or the general Directory DTO;
- participation/eligibility explanation copy;
- useful assignment/history filtering and contextual recommendation evidence.

Browser regression covers Directory → Profile → Contact retry/empty/validation/edit/save/refetch/403, privacy boundary and Back/Forward behavior.

### PX6 — Guided Add/Edit Person

Technically implemented on `main`:

- Identity, Contact, Organization, Participation and Review steps;
- canonical ordinary Contact full replacement;
- independent Contact/membership/responsibility/eligibility/availability resource states;
- responsibility assign and explicit end with `[startsAt, endsAt)` status semantics;
- availability add/remove/correct using canonical remove-old/add-new behavior;
- partial-persistence-safe retry with fresh authoritative reads and duplicate-mutation avoidance;
- unsaved-change protection, double-submit guard, pt-PT/en/es and human-readable review without technical IDs.

The **real-user write-capable production walkthrough remains intentionally deferred** in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`.

### PX7 — deterministic explainable recommendations

PX7.1–PX7.15 are now technically implemented.

PR #382 / main SHA `c407c9a5db653f15f619d652eba120d94858e50f` closes PX7.8 with a deliberately narrow persistent manual-exclusion contract:

- manual constraints are tenant + Person + assignment-type scoped and loaded server-side;
- browser mutation carries only meeting/slot/person identity plus explicit exclude/allow intent;
- meeting, assignment type, tenant, actor and capabilities are server-derived;
- manual exclusions move the matching candidate to structured excluded evidence with `MANUAL_EXCLUSION` and deterministically re-rank the remaining candidates;
- exact retries are idempotent and ambiguous concurrent creates recover authoritative state;
- no free-text reason, subjective boost score or Contact PII is persisted;
- audit/domain-event evidence identifies the operation without duplicating sensitive payloads;
- the Ant Design picker provides explicit confirmed exclude/remove actions with stale/double-submit protection and authoritative refetch;
- pt-PT/en/es copy is included.

Positive preference/boost scoring remains intentionally out of scope because no approved subjective product rule requires it. PX7 remains advisory: the human user makes the final assignment decision.

PR #382 exact head `221fc2c15d4fc92cc41e7dc504961c8a2081ac23` passed quality + browser-regression and canonical `netlify/eutakes` deploy-preview before squash merge.

### PX8 — responsible-person assistance

Technically integrated:

- absence affecting an assignment;
- canonical substitution suggestions where the reviewed recommendation contract supports them;
- incomplete-meeting attention;
- factual weekly load imbalance;
- long interval since last assignment;
- dismissible/navigable assistance cards;
- explicit unavailable states for missing capabilities;
- pt-PT/en/es;
- no autonomous assignment and no new browser-side ranking algorithm;
- tests prove assistance is built from explicit operational facts rather than judgmental/spiritual-value language.

### PX9 — Hourglass People parity

Technically integrated slices:

- **PX9.3 Labels/tags**: canonical server-owned explicit labels contract, management/filtering, partial-persistence-safe retries and privacy/authority coverage.
- **PX9.4 Reminders**: server-authoritative pending evidence, explicit same-origin send intent, stable mutation identity for ambiguous retries, authoritative refetch, safe notification preferences and `queued` rather than fabricated delivery semantics.
- **PX9.6 Archive / “A não publicar”**: explicit archive reason/date/current state/history, separate restore, generic-reactivation bypass protection, capability-aware API/UI and safe retry/refetch behavior.
- **PX9.7/PX9.8 Import**: source selection, bounded parsing, server-authoritative preview/validation/duplicate/conflict analysis.
- **PX9.9 Import execute/recovery**: atomic create-only apply/rollback, serialized replay protection, server-owned persisted execution attempts, authenticated prepare → confirm → execute handshake, explicit create-only rollback HTTP boundary and confirmed Ant Design UI. PR #379 main `bc53c5eec2923ce813a0ee026039c3822f7e0d5c`; PR #380 main `e7ba41d8aca0040392fff87788190e4a878c5e45`.
- **PX9.12 Contact List**: dedicated least-privilege server projection, configurable safe fields/filters, responsive UI and spreadsheet-safe CSV export without widening the general Directory DTO. PR #381 main `1c19692351f8633157146784ca76833b9dbf9e0b`.
- **PX9.13/PX9.14 Emergency mode** and emergency-contact boundary.
- **PX9.15 CSV export** with capability checks and spreadsheet-formula injection protection.

Destructive real-user production archive/import/rollback acceptance is **not** claimed complete; exact disposable-fixture scenarios belong in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`.

Remaining PX9 product/contract gaps:

- **PX9.1/PX9.2 Transfers** — no reviewed send/receive persistence and secure token lifecycle contract yet.
- **PX9.5 Record cards/reports** — report shape, period semantics and privacy/export contract are not approved.
- **PX9.10/PX9.11 Map** — no approved Person/group location model and least-privilege privacy/capability boundary exists.
- **PX9.16 PDF export** — depends on an approved report/contact-list document contract; do not widen private DTOs for convenience.
- **PX9.17 DOCX** remains product-research dependent and must not be implemented solely for parity.

### PX10 — quality / accessibility evidence

Technically automated and integrated:

- responsive/mobile/keyboard/theme/privacy/browser gates;
- permanent 200% desktop zoom-equivalent People reflow gate at 640 CSS px;
- permanent 400% desktop zoom-equivalent People reflow gate at 320 CSS px;
- People Directory header actions reflow long localized labels at 320 CSS px;
- Person Wizard included in the same zoom/reflow regression.

Still requires a human/independent acceptance agent where automation is insufficient:

- real screen-reader acceptance;
- write-capable real-user production walkthrough using approved disposable/real test data;
- final reference-quality product closeout after remaining approved PX9 product work and those human checks.

### PX11 — Ant Design migration / MUI retirement

Technically complete:

- remaining shared/runtime surfaces migrated to Ant Design 6;
- MUI/Emotion runtime dependencies removed from the web PWA package;
- regression guard prevents accidental MUI runtime reintroduction;
- full quality/browser/PWA/bundle coverage passed after retirement;
- Ant theme is authoritative.

## Production-only acceptance boundary

Automated tests, sanitized browser fixtures, preview deployments and CI do **not** prove real-user destructive/write production behavior or real assistive-technology behavior. Those scenarios remain documented in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md` and must be executed later by an independent agent with approved production credentials/data.

## Safe next engineering order

1. Preserve the green `c407c9a5...` People/PX baseline and its server authority/privacy boundaries.
2. Synchronize stale master-plan checkboxes only from integrated evidence; never reimplement completed slices because an older document lagged `main`.
3. Implement PX9.1/PX9.2 Transfers only after a reviewed server-owned persistence + secure one-time token lifecycle is defined.
4. Implement PX9.5 reports and PX9.16 PDF together only after a minimum-data report projection/period/privacy contract is approved.
5. Keep PX9.10/PX9.11 Map blocked until a location model and least-privilege precision/capability policy exist.
6. Keep PX9.17 DOCX deferred until product research demonstrates a need beyond CSV/PDF.
7. Perform real-user production and real screen-reader acceptance separately; do not replace them with mocked CI.
