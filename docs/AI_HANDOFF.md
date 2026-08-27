# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-27 after PX9.3 Labels integration. Historical worker reports and older acceptance summaries may be stale. Always fetch current `main` first.

## Mandatory reading order

Before coding, every Principal or worker agent MUST read, in this order:

1. `docs/AI_HANDOFF.md` — current project/priority rules.
2. `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` — what is actually integrated now and what remains blocked/deferred.
3. `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` — Product Experience requirements/task IDs; note that checkbox synchronization can lag integrated code and must be reconciled against the current-status document and `main` evidence before starting duplicate work.
4. `docs/PRODUCT_EXPERIENCE_INVENTORY.md` — capability/API/migration inventory.
5. The domain/security document directly relevant to the selected task.
6. For administrator-AI work, `docs/AI_AGENT_PRODUCT_SPEC.md`.

No agent may invent a competing DTO/domain model, client-only authority or UI direction merely to clear an unchecked task.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`
- Canonical production: `https://eutakes.netlify.app/`
- `https://rainbow-zuccutto-00d981.netlify.app/` is not the production acceptance target.
- Vercel statuses are not Eutaktos acceptance evidence.
- Current People/PX technical baseline after PX9.3 Labels: `4d6f0cd09f4567cf4ca8870f782308c144e7345e`.
- Earlier independently accepted People-core baseline `f013f72722c18a6df06ad7c6390be668ed239dbf` remains historical evidence, but substantial approved work has been integrated since then.

## Current product state

The following are technically integrated on `main`:

- PX5 ordinary Contact profile flow, richer participation explanation/filtering and profile regression coverage;
- PX6 complete guided Identity → Contact → Organization → Participation → Review workflow using canonical Contact/responsibility/availability contracts, authoritative refetch and partial-persistence-safe retries;
- PX7 deterministic explainable recommendations except PX7.8 manual constraints, which remains contract-blocked;
- PX8 operational assistance using reviewed authoritative evidence without autonomous assignment;
- approved PX9 slices including Labels/tags management/filtering, import source selection/preview, safe recovery boundary, emergency mode and safe CSV export;
- PX10 automated 200%/400% desktop zoom-equivalent reflow coverage for People Directory + Person Wizard;
- PX11 Ant Design 6 migration and MUI/Emotion runtime retirement.

Read `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` for exact boundaries and remaining gaps.

## Important unresolved boundaries

### PX7.8

Still blocked. There is no approved persistent manual-exclusion/preference contract. Do not create browser-only exclusions/preferences and call the task complete.

### Remaining PX9

Labels/tags are no longer a remaining gap: they are integrated through canonical People server authority and Directory UI.

The remaining slices require contract-first work:

- Transfers need reviewed send/receive persistence and a secure token lifecycle.
- Reminders may reuse `NotificationIntentService` for idempotent `assignment.reminder` intents, but still need an authoritative read model/API for who needs a reminder, reason and last reminder date.
- Record cards/reports need approved report shapes, period semantics and privacy/export rules.
- Archive / “A não publicar” needs reason/date/audit/restore persistence beyond the existing active flag.
- Map needs an approved location model and least-privilege capability/privacy boundary.
- Configurable Contact List needs a dedicated safe server projection/export contract; ordinary Contact must remain excluded from the general Directory DTO.
- Durable import execute/rollback still requires atomic transaction + migration-log + rollback architecture.
- PDF export should follow an approved report/contact-list contract; DOCX remains product-research dependent.

Do not implement these as frontend-only state or widen private DTOs merely to close master-plan checkboxes.

### Human production/accessibility acceptance

Real screen-reader acceptance and write-capable real-user production walkthroughs cannot be replaced with mocked browser fixtures. Required scenarios are kept in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md` for a later independent agent with approved credentials/data.

Do not mark those human scenarios complete from CI, sanitized fixtures, preview deploys or static inspection.

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

1. Preserve the current green People/PX baseline and canonical security/privacy boundaries.
2. Reconcile stale source-of-truth checkboxes/documentation against actual integrated evidence; never reimplement completed slices because an old checkbox was not synchronized.
3. Complete only remaining PX9 slices after their server/domain/privacy contracts are reviewed and implemented safely.
4. For Reminders, build the authoritative reminder-needed/last-reminder read model before UI; reuse the existing notification intent path for sending rather than inventing a second delivery path.
5. Keep PX7.8 blocked until a real manual-constraint contract exists.
6. Leave destructive/write real-user production acceptance and real screen-reader acceptance for the documented independent acceptance pass.
7. When only those human acceptance items remain, stop autonomous implementation rather than fabricating completion.

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
