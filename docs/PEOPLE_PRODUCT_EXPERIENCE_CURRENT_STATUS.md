# People Product Experience — current integrated status

> Principal status snapshot updated 2026-08-27 after PX10 zoom/reflow integration. This file records what is actually present on `main`; it does not turn deferred real-user production acceptance into automated evidence.

## Current baseline

- Repository: `bfrpaulondev/eutaktos`
- Canonical production: `https://eutakes.netlify.app/`
- Current technical People/PX baseline after PR #353: `a29645fa4acbde6a10a32d0090f7ff571a26d2ed`
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

Integrated through the PX8 People assistance work (`98e68ccfe13d1ff14b02dedf7f1ffa2bd9a426fb` and subsequent main history):

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

- import source selection;
- server-authoritative import preview/validation/duplicate/conflict analysis;
- dry-run/recovery boundary with execute/rollback deliberately blocked until durable atomic transaction + migration-log rollback architecture exists;
- emergency mode and emergency-contact boundary;
- existing capability-aware People Directory CSV export with spreadsheet-formula injection protection.

Still not safely complete without reviewed contracts/persistence: transfers, labels/tags, reminders, record cards/reports, archive/do-not-publish, map/location privacy model, complete configurable Contact List projection, and durable import execute/rollback.

Do not create those as frontend-only state or widen private DTOs without a Principal-reviewed server contract.

### PX10 — quality / accessibility evidence

Technically automated and integrated:

- existing responsive/mobile/keyboard/theme/privacy/browser gates;
- permanent 200% desktop zoom-equivalent People reflow gate at 640 CSS px;
- permanent 400% desktop zoom-equivalent People reflow gate at 320 CSS px;
- People Directory header actions fixed to reflow long localized labels at 320 CSS px;
- Person Wizard included in the same zoom/reflow regression;
- PR #353 exact head `6fb16d78cf541cced7f39d635e96ded3a5cc7dfe` passed `quality`, full `browser-regression`, and canonical `netlify/eutakes/deploy-preview` before squash merge `a29645fa4acbde6a10a32d0090f7ff571a26d2ed`.

Still requires a human/independent acceptance agent where automation is insufficient:

- real screen-reader acceptance;
- write-capable real-user production walkthrough using approved disposable/real test data;
- final reference-quality product closeout after those human checks.

### PX11 — Ant Design migration / MUI retirement

Technically complete at the current baseline:

- People and supporting runtime surfaces migrated to Ant Design 6;
- MUI/Emotion runtime dependencies removed from the web PWA package;
- regression guard prevents accidental MUI runtime reintroduction;
- Ant theme is authoritative.

## Production-only acceptance boundary

Automated tests, sanitized browser fixtures, preview deployments and CI do **not** prove real-user destructive/write production behavior. Those scenarios remain documented in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md` and must be executed later by an independent agent with approved production credentials/data.

## Safe next engineering order

1. Keep current main green and preserve the accepted People/PX behavior.
2. Synchronize stale master-plan checkboxes only when the corresponding integrated evidence is traceable; never use checkbox edits to manufacture completion.
3. For remaining PX9 work, define/review server contracts and persistence first, then UI.
4. Keep PX7.8 blocked until a real manual constraint contract exists.
5. Perform the deferred real-user production/screen-reader acceptance separately; do not replace it with mocked CI.
