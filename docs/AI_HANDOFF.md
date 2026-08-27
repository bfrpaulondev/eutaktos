# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-27 after final Principal review and integration of PX9.10/PX9.11 People Map. Historical worker reports and older acceptance summaries may be stale. Always fetch current `main` first.

## Mandatory reading order

Before coding, every Principal or worker agent MUST read, in this order:

1. `docs/AI_HANDOFF.md` — current project/priority rules.
2. `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` — current integrated People reference-module status.
3. `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` — Product Experience requirements/task IDs.
4. `docs/PRODUCT_EXPERIENCE_INVENTORY.md` — capability/API/integration inventory.
5. The domain/security document directly relevant to the selected task.
6. For administrator-AI work, `docs/AI_AGENT_PRODUCT_SPEC.md`.

No agent may invent a competing DTO/domain model, client-only authority or UI direction merely to clear an old unchecked task.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`.
- Canonical production acceptance target: `https://eutakes.netlify.app/`.
- `rainbow-zuccutto-00d981` is not the canonical acceptance target.
- Vercel rate-limit/build-limit statuses are not Eutaktos acceptance evidence.
- Current People technical runtime baseline: `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.
- Earlier C6 People-core baseline remains historical acceptance evidence but does not replace the later integrated People composition.

## People reference module — technical status

**People is technically complete.**

Integrated on `main`:

- People Overview and Directory 2.0;
- unified Person Profile;
- complete guided Add/Edit Person workflow;
- ordinary Contact under a dedicated least-privilege boundary;
- households, service groups and responsibilities context;
- availability and explicit eligibility;
- PX7 deterministic explainable recommendations including persistent explicit manual exclusions;
- PX8 factual responsible-person assistance;
- secure People Transfers;
- Labels/tags;
- Reminders;
- Record Cards/reports;
- Archive / “A não publicar”;
- Hourglass import source/preview plus authenticated prepare → confirm → execute and create-only rollback/recovery;
- configurable Contact List;
- emergency mode/emergency contacts;
- safe CSV export;
- direct Record Cards PDF export;
- PX9.10/PX9.11 privacy-first People Map;
- PX10 automated responsive/keyboard/privacy and 200%/400% reflow evidence;
- PX11 Ant Design 6 migration and MUI/Emotion runtime retirement.

See `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` and `docs/PEOPLE_TECHNICAL_CLOSEOUT_AUDIT_2026-08-27.md` for exact evidence.

## People Map authoritative boundary

PR #392 was Principal-reviewed/corrected and squash-integrated as main `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.

Final reviewed PR head: `ad5b86bf9a40a9c75dafe7495e0ffdbc3b25ddfc`.

Final exact-head gates: GitHub Actions `33115570822` / #986, `quality` PASS, `browser-regression` PASS, canonical `netlify/eutakes/deploy-preview` PASS.

Do not rebuild or fork the Map contract.

Authoritative rules:

- read requires server-derived `people.read + map.read`;
- set/remove require server-derived `people.write + map.write`;
- `map.read` / `map.write` are sensitive capabilities;
- `tenant.manage`, People-only capabilities, Contact access and browser claims do not imply Map access;
- tenant/actor/capabilities remain server-derived;
- dedicated tenant-scoped location persistence;
- explicit manual approximate coordinates only;
- server normalizes to at most two decimals before persistence;
- no automatic ordinary-Contact geocoding;
- no browser/IP/device geolocation;
- no inferred location;
- `GET /api/people/map` remains minimum-data: Person ID, display name and normalized approximate coordinates only;
- archived/non-publishable People are excluded;
- no coordinates in general audit/outbox payload metadata;
- same-Person mutations are serialized to preserve concurrent retry idempotency;
- Leaflet/OpenStreetMap is lazy-loaded;
- Person/group overlays are local and identity is never included in tile requests;
- graphical map has an equivalent semantic list;
- PX9.11 group filter/legend is derived locally from the existing authorized Service Group projection and does not widen `people-map-v1`;
- pt-PT/en/es, keyboard selection, loading/empty/error/retry/401/403, stale ownership and double-submit protection are required;
- responsive/reflow coverage includes 320/375/390/430/640/768/1024/1280/1440.

Historical `principal/px9-people-map` is quarantined and must not be reused; it predates the final contract.

## PX9.17 DOCX

PX9.17 is **DEFERRED / NOT REQUIRED** for People technical completion.

CSV and PDF cover the currently approved People export needs. Do not implement DOCX solely for competitor parity. Add it only if later user/product evidence establishes a concrete need. See `docs/PEOPLE_DOCX_EXPORT_DECISION.md`.

## Human production/accessibility acceptance

Real screen-reader acceptance and write-capable real-user production walkthroughs cannot be replaced by mocked/sanitized browser fixtures.

They remain separate acceptance tasks in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`.

Do not mark them complete from CI, previews, static inspection or automated semantics alone.

## Next Product Experience priority

The next reference-quality rebuild target is **Organization 2.0**.

Use People as the design/engineering pattern rather than starting a new design language.

Organization 2.0 should reuse existing authoritative contracts for:

- People identities/profile navigation;
- households/families;
- service groups and memberships;
- responsibility assignments;
- congregation settings where applicable;
- session/capability enforcement;
- audit/history;
- Ant Design 6 interaction and responsive patterns.

Do not create duplicate organization stores merely because older UI screens are fragmented.

Recommended module sequence after People:

`Organization 2.0 → Prepare Meeting 2.0 → Planning 2.0 → global Home/Dashboard refinement → Administration refinement`.

## Product direction

Eutaktos is an organization assistant, not generic CRUD. It should:

- show what needs attention;
- explain why;
- guide the next action;
- provide deterministic/explainable assistance;
- preserve human decision-making;
- make operational workflows simpler and safer.

Recommendation evidence is advisory. Never auto-assign solely because somebody ranks first.

## UI direction

Ant Design 6 is the authoritative runtime component foundation.

MUI/Emotion runtime dependencies are retired and guarded from reintroduction.

Do not add new MUI runtime dependencies or create a second design system.

Reuse the People reference patterns for headers, attention cards, lists/tables, drawers/modals, async states, permission gating, responsive behavior and accessibility.

## Administrator AI

The server core remains advisory/read-only and must follow `docs/AI_AGENT_PRODUCT_SPEC.md`:

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

`ASSIGNED → IN PROGRESS → PR/REVIEW → INTEGRATED MAIN → EXACT-HEAD GATES GREEN → REQUIRED UX/PRODUCTION EVIDENCE → DONE`

A branch, commit, worker report, screenshot, preview deployment or green local test alone is not `DONE`.

For behavior explicitly requiring human production or assistive-technology acceptance, automated evidence may prove technical readiness but not final human acceptance.

## Ownership and branch discipline

- Principal: source of truth, architecture, worker review/correction, integration, acceptance evidence and status synchronization.
- Workers: explicitly scoped tasks only; one branch per task/tightly coupled slice; no direct main commits, merges or force-push.
- Workers report exact task ID, base SHA, final head, changed files, tests and limitations.
- Parallel workers do not edit the same product slice unless Principal coordinates it.

## Non-negotiable engineering rules

- Preserve tenant isolation, capabilities, audit and domain events.
- Tenant/actor/capabilities are server-derived; never trust frontend values.
- Cross-tenant denial occurs before projection/persistence.
- No unnecessary PII in logs, audit summaries, analytics, URLs, domain events or client storage.
- Private authenticated API responses are not PWA/service-worker cached.
- Every async UI surface owns loading/empty/error/retry states where applicable.
- Prevent duplicate submissions and stale-response overwrites.
- Preserve pt-PT/en/es.
- WCAG 2.2 AA is the minimum accessibility release floor.
- New Product Experience surfaces use Ant Design 6.
- Reuse current application/domain contracts before adding backend behavior.
- Human choice remains final for recommendation-driven workflows.

## Starting any new task

1. Fetch current `main` and record SHA.
2. Read this file plus relevant current-status/master/inventory docs.
3. Inspect current implementation/tests before assuming a feature is missing.
4. Confirm no active PR owns the same slice.
5. Confirm server/domain/privacy contract before UI.
6. Branch from current `main`.
7. Implement real behavior plus tests and async/error ownership.
8. Run relevant quality/browser/privacy/build gates and canonical Netlify preview.
9. Merge only after exact-head gates are green.
10. Synchronize source-of-truth documentation without claiming deferred human acceptance.
