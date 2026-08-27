# People Product Experience — current integrated status

> Principal status snapshot updated 2026-08-27 after PX9.6 Archive / “A não publicar” integration and the latest Hourglass recovery foundations. This file records what is actually present on `main`; it does not turn deferred real-user production acceptance into automated evidence.

## Current baseline

- Repository: `bfrpaulondev/eutaktos`
- Canonical production: `https://eutakes.netlify.app/`
- Current technical People/PX baseline: `1d2a2da0905ecf1b3c64031efdbee5069a16985d`.
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

PX7.1–PX7.7 and PX7.9–PX7.15 are implemented. PX7 remains advisory: the human user makes the final assignment decision.

**PX7.8 remains blocked by contract**, not by UI work: there is no approved persistent manual-exclusion/preference domain contract. Do not invent one in browser state merely to close the item.

### PX8 — responsible-person assistance

Integrated through the PX8 People assistance work:

- absence affecting an assignment;
- canonical substitution suggestions where the reviewed recommendation contract supports them;
- incomplete-meeting attention;
- factual weekly load imbalance;
- long interval since last assignment;
- dismissible/navigable assistance cards;
- explicit unavailable states for missing capabilities;
- pt-PT/en/es;
- no autonomous assignment and no new browser-side ranking algorithm.

### PX9 — Hourglass People parity

Implemented technical slices:

- **PX9.3 Labels/tags**: canonical server-owned explicit labels contract, normalization/persistence through People service, capability-aware HTTP/client round trip, People Directory management and local filtering, partial-persistence-safe retries, privacy boundary tests and browser authority regression.
- **PX9.4 Reminders**: server-authoritative pending evidence, explicit same-origin send intent, stable mutation identity for ambiguous retries, authoritative refetch, safe notification preferences and `queued` rather than fabricated delivery semantics.
- **PX9.6 Archive / “A não publicar”**: explicit server persistence for archive reason/date/current state and append-only history; archive forces inactive state; restore is a separate explicit operation; generic profile reactivation cannot bypass restore; GET/POST archive HTTP boundary is tenant/capability controlled and does not expose actor IDs/internal prior-state snapshots; Ant Design People tool supports read-only inspection, explicit archive/restore confirmations, pt-PT/en/es, stale-response ownership, double-submit protection and authoritative post-write refetch.
- **PX9.7/PX9.8 import foundations**: source selection plus server-authoritative Hourglass preview/validation/duplicate/conflict analysis.
- **PX9.9 recovery foundations**: atomic create-only import commit and rollback primitives, durable migration evidence, serialized retry/replay protection and an internal Hourglass-specific server execution composition that rebuilds fresh authoritative state immediately before commit.
- **PX9.13/PX9.14 emergency mode** and emergency-contact boundary.
- **PX9.15 CSV export** through the capability-aware People Directory export with spreadsheet-formula injection protection.

PX9.6 UI/API technical integration was accepted through PR #377 at exact head `30c926fece86d9b1c960a832318f942b0ff1e673`: quality PASS, browser-regression PASS, canonical `netlify/eutakes` deploy-preview PASS, then squash-merged as main SHA `1d2a2da0905ecf1b3c64031efdbee5069a16985d`.

The destructive real-user production archive/restore walkthrough is **not** claimed complete; its exact disposable-fixture scenario is recorded in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`.

Remaining PX9 contract/product gaps:

- **PX9.1/PX9.2 Transfers** — no reviewed send/receive persistence and secure token lifecycle contract yet.
- **PX9.5 Record cards/reports** — report shape, period semantics and privacy/export contract are not approved.
- **PX9.9 user-facing execute/rollback** — persistence and internal execution composition now exist, but no authenticated prepare → confirm → execute HTTP handshake or authorized rollback HTTP/UI is exposed. Browser timestamps/tenant/actor/capabilities must never become authority when this boundary is added.
- **PX9.10/PX9.11 Map** — no approved person/group location model and privacy capability boundary exists.
- **PX9.12 Configurable Contact List** — ordinary Contact is intentionally a dedicated least-privilege resource and is excluded from Directory; a safe server projection/export contract is required before bulk contact-list UI.
- **PX9.16 PDF export** — implement only against an approved report/contact-list contract; do not widen private DTOs for convenience.
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
- final reference-quality product closeout after those human checks.

### PX11 — Ant Design migration / MUI retirement

Technically complete:

- People and supporting runtime surfaces migrated to Ant Design 6;
- MUI/Emotion runtime dependencies removed from the web PWA package;
- regression guard prevents accidental MUI runtime reintroduction;
- Ant theme is authoritative.

## Production-only acceptance boundary

Automated tests, sanitized browser fixtures, preview deployments and CI do **not** prove real-user destructive/write production behavior. Those scenarios remain documented in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md` and must be executed later by an independent agent with approved production credentials/data.

## Safe next engineering order

1. Keep current main green and preserve the accepted People/PX behavior.
2. Synchronize stale master-plan checkboxes only when corresponding integrated evidence is traceable; never use checkbox edits to manufacture completion.
3. Do not create second implementations for Labels, Reminders or Archive; those slices now have canonical server authority and People UI.
4. Complete the PX9.9 authenticated prepare → confirm → execute handshake and create-only rollback HTTP/UI only if the server can own the execution attempt and freshness proof without trusting browser authority.
5. For each other remaining PX9 slice, define/review server authority, persistence and privacy contracts first; only then build UI.
6. Keep PX7.8 blocked until a real persistent manual-constraint contract exists.
7. Perform deferred real-user production/screen-reader acceptance separately; do not replace it with mocked CI.
