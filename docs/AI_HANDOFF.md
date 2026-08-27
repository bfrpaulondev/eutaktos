# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-27 after PX9.16 direct Record Cards PDF export, PX9.1/PX9.2 secure People Transfers integration and the technically validated PX9.10/PX9.11 People Map PR #392. Historical worker reports and older acceptance summaries may be stale. Always fetch current `main` first.

## Mandatory reading order

Before coding, every Principal or worker agent MUST read, in this order:

1. `docs/AI_HANDOFF.md` — current project/priority rules.
2. `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` — what is actually integrated now and what remains blocked/deferred.
3. `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` — Product Experience requirements/task IDs; checkbox synchronization can lag integrated code and must be reconciled against current status and `main` evidence before starting duplicate work.
4. `docs/PRODUCT_EXPERIENCE_INVENTORY.md` — capability/API/migration inventory.
5. The domain/security document directly relevant to the selected task.
6. For administrator-AI work, `docs/AI_AGENT_PRODUCT_SPEC.md`.

No agent may invent a competing DTO/domain model, client-only authority or UI direction merely to clear an unchecked task.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`
- Canonical production: `https://eutakes.netlify.app/`
- `https://rainbow-zuccutto-00d981.netlify.app/` is not the production acceptance target.
- Vercel statuses are not Eutaktos acceptance evidence.
- Current People/PX technical baseline: `550ff297c7937b11ee6be69600df28afb2712ea6`.
- Earlier independently accepted People-core baseline `f013f72722c18a6df06ad7c6390be668ed239dbf` remains historical evidence, but substantial approved work has been integrated since then.

## Current product state

Technically integrated on `main`:

- PX5 ordinary Contact profile flow, participation explanation/filtering and profile regressions;
- PX6 complete guided Identity → Contact → Organization → Participation → Review workflow using canonical Contact/responsibility/availability contracts and partial-persistence-safe retries;
- PX7 deterministic explainable recommendations including persistent explicit manual exclusions (PX7.8), while human choice remains final;
- PX8 operational assistance from explicit reviewed facts only;
- PX9 secure send/receive Transfers, Labels/tags, Reminders, Record Cards/reports, Archive / “A não publicar”, import source selection/preview, authenticated Hourglass prepare → confirm → execute + create-only rollback, emergency mode, configurable Contact List, safe CSV export and direct Record Cards PDF export;
- PX10 automated 200%/400% People zoom/reflow coverage plus existing responsive/theme/keyboard/privacy gates;
- PX11 Ant Design 6 migration and MUI/Emotion runtime retirement.

Technically ready for Principal review/integration on PR #392:

- PX9.10/PX9.11 People Map, using the approved dedicated approximate manual location contract, minimum-data projection, explicit `people.read + map.read` read gate, explicit `map.write` mutation gate, local-only Leaflet overlays and equivalent accessible list. CI quality, CI browser-regression and canonical `netlify/eutakes` preview passed on implementation commit `7259c5daf3d4f835739825beed6f7f817e782ac8`.

Read `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` for exact boundaries and evidence.

## Important remaining boundaries

### PX7

PX7.8 is no longer blocked. PR #382 introduced a persistent tenant/person/assignment-type manual-exclusion contract and server-authoritative mutation/read path. Do not create a second exclusion implementation or add subjective preference/boost scoring without a separately approved product rule.

### PX9 Transfers now integrated

PR #387 implements the reviewed People transfer lifecycle. Do not replace it with browser-owned transfer state or predictable codes.

Authoritative boundary:

- sender selects explicit active People and confirms the privacy/minimum-data transfer scope;
- transfer secret is 256-bit URL-safe random material; only its SHA-256 digest is persisted;
- transfer expires after 72 hours and may be claimed once atomically;
- same-destination exact claim retries recover idempotently;
- sender may cancel a pending transfer, including recovery after an ambiguous/lost send response;
- source People are never deleted automatically;
- destination People receive new Person IDs;
- transferred data is minimum-data only: display name, preferred locale and ordinary Contact;
- emergency contacts, eligibility, availability, labels, groups, responsibilities, assignment history and external IDs are excluded;
- tenant, actor and capabilities remain server-derived;
- history never returns the raw transfer secret or ordinary Contact values.

### PX9 Record Cards/PDF now integrated

PX9.5 uses a purpose-built minimum-data report projection with annual/bounded civil-date period semantics and explicit report capability checks. PX9.16 renders direct binary PDF only from the current successful authorized preview and adds no wider DTO/PII boundary.

Do not widen Directory, Contact List or private DTOs to support reports/PDF.

### Remaining PX9

The only unresolved PX9 product slice is **PX9.17 DOCX**, intentionally research-deferred and not required solely for competitor parity while CSV/PDF already cover approved export needs.

For People Map, preserve `docs/PEOPLE_MAP_CONTRACT.md`: ordinary Contact postal addresses are not authorization to geocode, persist or expose coordinates; browser/IP geolocation and automatic geocoding remain prohibited. Do not create a competing location model.

### Hourglass import boundary already integrated

The authoritative Hourglass path is now:

- local supported-source inspection;
- read-only server reconciliation preview;
- `POST /api/import/hourglass/prepare` creating/recovering a server-owned execution attempt bound to the exact preview digest;
- explicit browser confirmation;
- `POST /api/import/hourglass/execute` re-validating the source/attempt and committing atomically under server-derived authority;
- optional `POST /api/import/hourglass/rollback` for the proven create-only migration shape;
- exact retry/replay protection, stale confirmation rejection and authoritative state verification.

Do not reintroduce browser-owned timestamps, tenant/actor/capabilities, per-row writes or name-based identity matching.

### Contact List boundary already integrated

PX9.12 uses a dedicated least-privilege Contact List server projection and export path. Ordinary Contact remains excluded from the general Directory DTO. Do not widen Directory merely to expose bulk phone/email/address data.

### Human production/accessibility acceptance

Real screen-reader acceptance and write-capable real-user production walkthroughs cannot be replaced with mocked browser fixtures. Required scenarios are kept in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md` for a later independent agent with approved credentials/data.

Do not mark those human scenarios complete from CI, sanitized fixtures, preview deployments or static inspection.

## Product direction

Eutaktos is an organization assistant, not generic CRUD. It must:

- show what needs attention;
- explain why;
- guide the next action;
- provide deterministic, explainable candidate suggestions;
- preserve human decision-making;
- make useful Hourglass People capabilities simpler and safer.

Recommendation evidence is advisory. Never auto-assign solely because somebody ranks first.

## UI direction

Ant Design 6 is the authoritative runtime component foundation. MUI/Emotion runtime dependencies have been retired from the web PWA and a regression boundary prevents reintroduction.

Do not add new MUI runtime dependencies or create a second design system.

## Current priority order

1. Preserve the green People/PX baseline and canonical security/privacy boundaries.
2. Reconcile stale source-of-truth checkboxes/documentation against actual integrated evidence; never reimplement completed slices because an old checkbox was not synchronized.
3. Preserve the reviewed PX9.10/PX9.11 Map contract and its explicit privacy/capability boundary; do not infer permission from ordinary Contact address data.
4. Keep PX9.17 DOCX research-deferred until product evidence shows a need beyond CSV/PDF.
5. Leave destructive/write real-user production acceptance and real screen-reader acceptance for the documented independent acceptance pass.
6. When no safe technical work remains beyond intentionally deferred product research/human acceptance, stop autonomous implementation rather than fabricate completion.

## Administrator AI

The server core is advisory/read-only and must follow `docs/AI_AGENT_PRODUCT_SPEC.md`:

- `OPENAI_KEY_AGENT` server-side only;
- tenant/actor/capabilities from authenticated server session;
- model/tool arguments untrusted;
- no direct SQL/database tool;
- minimum necessary PII;
- PX7 authoritative for recommendation facts;
- no autonomous writes;
- no spirituality/personal-worth/sensitive-attribute inference;
- explicit human confirmation before any future write flow.

## Definition of done

Normal engineering sequence:

`ASSIGNED → IN PROGRESS → PR/REVIEW → INTEGRATED MAIN → RELEVANT GATES GREEN → REQUIRED UX/PRODUCTION EVIDENCE → DONE`

A branch, commit, screenshot, preview deployment or green local test alone is not `DONE`.

For behavior that explicitly requires human real-user production or assistive-technology acceptance, automated evidence may prove technical readiness but not final human acceptance.

## Ownership and branch discipline

- Principal: source of truth, architecture, review/correction, integration, acceptance evidence and status synchronization.
- Workers: only explicitly scoped tasks; one branch per task/tightly coupled slice; no direct main commits, merges or force-push.
- Workers must report exact PX ID and base main SHA.
- Parallel workers must not edit the same product slice unless Principal explicitly coordinates it.

## Non-negotiable engineering rules

- Preserve tenant isolation, capabilities, audit and domain events.
- Tenant/actor/capabilities are server-derived; never trust frontend values.
- No unnecessary PII in logs, audit summaries, analytics, URLs, domain events or client storage.
- Private authenticated API responses must not be cached by the PWA/service worker.
- Every async UI surface owns loading/empty/error/retry states where applicable.
- Prevent duplicate submissions and stale-response overwrites.
- Preserve pt-PT/en/es.
- WCAG 2.2 AA is the minimum accessibility release floor.
- New Product Experience surfaces use Ant Design 6.
- Reuse existing People/organization/application contracts before creating backend behavior.
- Human choice remains final for recommendation-driven workflows.

## Starting any new task

1. Fetch current `main` and record SHA.
2. Read this file plus current People status/master/inventory.
3. Inspect `main` implementation/tests before assuming the feature is missing.
4. Confirm no open PR owns the same slice.
5. Confirm the required server/domain/privacy contract exists; if not, design/review it before UI.
6. Branch from current `main`.
7. Implement production behavior, tests and error/retry ownership.
8. Run relevant quality/browser/privacy/build gates and canonical Netlify preview.
9. Merge only after exact-head gates are green.
10. Update current-status/source-of-truth documentation without claiming deferred human acceptance.
