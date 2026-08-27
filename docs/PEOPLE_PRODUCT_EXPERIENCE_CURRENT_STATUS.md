# People Product Experience — current integrated status

> Principal status snapshot updated 2026-08-27 after PX9.16 direct Record Cards PDF and PX9.1/PX9.2 secure People Transfers integration. This file records what is actually present on `main`; it does not turn deferred real-user production acceptance into automated evidence.

## Current baseline

- Repository: `bfrpaulondev/eutaktos`
- Canonical production: `https://eutakes.netlify.app/`
- Current technical People/PX baseline: `550ff297c7937b11ee6be69600df28afb2712ea6`.
- PX9.5 Record Cards runtime integration: `e8d25f0e0d36305cc618e94ca1f52d17a5db9157`.
- PX9.16 direct PDF integration: `dae654390d17cdf76545519910a375ebf3c04ff6`.
- PX9.1/PX9.2 secure Transfers integration: `550ff297c7937b11ee6be69600df28afb2712ea6`.
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

PX7.1–PX7.15 are technically implemented.

PR #382 / main SHA `c407c9a5db653f15f619d652eba120d94858e50f` closes PX7.8 with a deliberately narrow persistent manual-exclusion contract:

- manual constraints are tenant + Person + assignment-type scoped and loaded server-side;
- browser mutation carries only meeting/slot/person identity plus explicit exclude/allow intent;
- meeting, assignment type, tenant, actor and capabilities are server-derived;
- manual exclusions move the matching candidate to structured excluded evidence with `MANUAL_EXCLUSION` and deterministically re-rank remaining candidates;
- exact retries are idempotent and ambiguous concurrent creates recover authoritative state;
- no free-text reason, subjective boost score or Contact PII is persisted;
- audit/domain-event evidence identifies the operation without duplicating sensitive payloads;
- the Ant Design picker provides explicit confirmed exclude/remove actions with stale/double-submit protection and authoritative refetch;
- pt-PT/en/es copy is included.

Positive preference/boost scoring remains intentionally out of scope because no approved subjective product rule requires it. Human choice remains final.

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

- **PX9.1/PX9.2 Transfers**: server-owned send/receive persistence and secure token lifecycle. PR #387 exact head `77d2c8fa2456a7eddb28b3d8c14460f8e8b187b9`; squash merge `550ff297c7937b11ee6be69600df28afb2712ea6`. Secret material is 256-bit URL-safe random data; only SHA-256 is persisted; expiry is 72 hours; claim is one-time and atomic; same-destination exact retry is idempotent; sender can cancel pending transfers; source People are never deleted automatically; destination People receive new IDs. Payload is minimum-data only: display name, preferred locale and ordinary Contact. Emergency contacts, eligibility, availability, labels, groups, responsibilities, assignment history and external IDs are excluded. History never exposes raw secret or Contact values. CI run `33075558542` PASS and canonical `netlify/eutakes/deploy-preview` PASS on exact head. Vercel rate-limit statuses are not Eutaktos acceptance gates.
- **PX9.3 Labels/tags**: canonical server-owned explicit labels contract, management/filtering, partial-persistence-safe retries and privacy/authority coverage.
- **PX9.4 Reminders**: server-authoritative pending evidence, explicit same-origin send intent, stable mutation identity for ambiguous retries, authoritative refetch, safe notification preferences and `queued` rather than fabricated delivery semantics.
- **PX9.5 Record Cards / Reports**: purpose-built `GET /api/people/record-cards` projection requiring server-derived `people.read + schedule.read + reports.read`; annual or bounded civil-date period selectors; authoritative completed scheduling history projected into minimum-data person cards; excludes Contact/emergency/eligibility/availability/archive/recommendation data; Ant UI provides year/custom preview, stale-request ownership and print action. PR #383 exact head `1a6f4293566e55e9fea12bb292119453bbdf5e02`; squash merge `e8d25f0e0d36305cc618e94ca1f52d17a5db9157`.
- **PX9.6 Archive / “A não publicar”**: explicit archive reason/date/current state/history, separate restore, generic-reactivation bypass protection, capability-aware API/UI and safe retry/refetch behavior.
- **PX9.7/PX9.8 Import**: source selection, bounded parsing, server-authoritative preview/validation/duplicate/conflict analysis.
- **PX9.9 Import execute/recovery**: atomic create-only apply/rollback, serialized replay protection, server-owned persisted execution attempts, authenticated prepare → confirm → execute handshake, explicit create-only rollback HTTP boundary and confirmed Ant Design UI. PR #379 main `bc53c5eec2923ce813a0ee026039c3822f7e0d5c`; PR #380 main `e7ba41d8aca0040392fff87788190e4a878c5e45`.
- **PX9.12 Contact List**: dedicated least-privilege server projection, configurable safe fields/filters, responsive UI and spreadsheet-safe CSV export without widening the general Directory DTO. PR #381 main `1c19692351f8633157146784ca76833b9dbf9e0b`.
- **PX9.13/PX9.14 Emergency mode** and emergency-contact boundary.
- **PX9.15 CSV export** with capability checks and spreadsheet-formula injection protection.
- **PX9.16 Direct PDF export**: browser-local direct binary PDF generation from the already-authorized PX9.5 Record Cards projection only. No new DTO or PII boundary; Unicode preserved through canvas text rendering; no report persistence; export invalidates with stale preview; double-submit and generation errors handled; pt-PT/en/es. PR #386 exact head `45033ed02aaa80cabd9eefd7bb743b5906fbba1a`; squash merge `dae654390d17cdf76545519910a375ebf3c04ff6`.

Destructive/write real-user production acceptance is **not** claimed complete; exact disposable-fixture scenarios belong in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`.

Remaining PX9 product/contract gaps:

- **PX9.10/PX9.11 Map** — blocked. There is no approved Person/group geolocation model, coordinate source-of-truth, precision policy or least-privilege map capability boundary. Ordinary Contact postal address must not be treated as implicit authorization to geocode, persist or expose coordinates.
- **PX9.17 DOCX** — intentionally product-research deferred. CSV and PDF cover the currently approved export needs; DOCX must not be added solely for parity.

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
- final reference-quality product closeout after the explicit human checks. Map remains blocked by an absent product/privacy contract and DOCX is research-deferred; neither may be fabricated as complete.

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

1. Preserve the green `550ff297...` People/PX baseline and its server authority/privacy boundaries.
2. Do not rebuild PX7.8, Transfers, Hourglass execute/rollback, Contact List, Record Cards or direct PDF because older checkboxes/text may lag integrated evidence.
3. Keep PX9.10/PX9.11 Map blocked until product/security explicitly approve a geolocation model, coordinate source, precision policy and least-privilege capability boundary.
4. Keep PX9.17 DOCX deferred until product research demonstrates a need beyond CSV/PDF.
5. Perform real-user production and real screen-reader acceptance separately; do not replace them with mocked CI.
6. If those are the only remaining items, autonomous implementation should stop rather than invent contracts or fabricate acceptance.
