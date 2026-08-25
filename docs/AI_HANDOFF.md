# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-25 after PX2 integration and principal PX0 inventory. Read this before taking any Eutaktos task. Historical pilot/worker reports may contain stale deployment, branch or priority information.

## Mandatory reading order

Before coding, every principal or worker agent MUST read, in this order:

1. `docs/AI_HANDOFF.md` — current project/priority state.
2. `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` — active Product Experience requirements, task IDs, checkboxes and definition of done.
3. `docs/PRODUCT_EXPERIENCE_INVENTORY.md` — current MUI migration boundaries and People/API capability inventory.
4. Any domain/security document directly relevant to the selected task.
5. For administrator-AI work, also read `docs/AI_AGENT_PRODUCT_SPEC.md`.

No agent may invent a competing UI direction or begin an unchecked Product Experience task without first checking the master plan.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`
- Product Experience reset baseline: `be68797922b2a9f96b5fe47e906a95cdfbcf77cb`
- Wave A foundation through PX2 was integrated on `main` at `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2`; always fetch current `main` because this SHA becomes historical as soon as new work merges.
- **Canonical production: `https://eutakes.netlify.app/`**
- `https://rainbow-zuccutto-00d981.netlify.app/` is not the production acceptance target.
- Vercel deployments are not Eutaktos production acceptance evidence.

## Current product decision

The technical/domain/security foundation is mature enough to support the Product Experience rebuild, but the product is not complete until the People reference workflow reaches the standard in the master plan.

Eutaktos is an **organization assistant**, not a prettier CRUD application. It must:

- show what needs attention;
- explain why;
- guide the next action;
- provide deterministic, explainable candidate suggestions for assignments;
- preserve human decision-making;
- cover useful Hourglass People capabilities while making them simpler and safer.

## Current foundation status

### Integrated

- PX1 technical Ant Design 6 foundation and semantic Light/Dark/System implementation: PR #283.
- PX3 first People Overview slice with principal corrections: PR #289.
- Secure advisory administrator-AI server core: PR #288; the AI feature itself is not complete.
- PX2 task-oriented Ant shell/navigation: PR #291.

### Important acceptance distinction

Integrated code and green CI are necessary but not sufficient for all Product Experience checkboxes. Theme/product checkboxes that require independent real-user visual acceptance remain open until that evidence exists.

## UI component direction

The Product Experience rebuild uses **Ant Design 6** as the primary component foundation.

Migration is incremental:

1. Ant Design foundation/themes — technically integrated;
2. task-oriented shell/navigation — integrated;
3. rebuild People end to end — active;
4. prove the new patterns;
5. migrate remaining screens;
6. remove MUI only when no approved runtime consumer remains.

Do not create new Product Experience screens with MUI after the Ant foundation unless the principal explicitly approves a temporary migration exception.

Legacy MUI runtime consumers and the migration boundary are inventoried in `docs/PRODUCT_EXPERIENCE_INVENTORY.md`.

## Current priority order

Wave A foundation is technically integrated. The active product sequence is now:

1. Finish PX0 governance/evidence synchronization.
2. PX4 — Directory 2.0.
3. PX5 — Unified Person Profile.
4. PX6 — Guided Add/Edit Person.
5. PX7 — deterministic explainable recommendation engine may proceed in parallel in domain/application.
6. PX8 — responsible-person assistance using PX7 evidence.
7. PX9 — useful Hourglass People parity, simplified and improved.
8. PX10 — UX/accessibility/security/production acceptance.
9. PX11 — remaining MUI retirement after People proves the pattern.

Do not skip ahead to broad feature expansion while the reference People experience remains unfinished.

## Administrator AI

The server core from PR #288 is advisory/read-only and uses server-derived authorization. It is only the foundation.

The AI must follow `docs/AI_AGENT_PRODUCT_SPEC.md`:

- `OPENAI_KEY_AGENT` remains server-side only;
- tenant/actor/capabilities come from the authenticated server session;
- model/tool arguments are untrusted;
- no direct SQL/database tool;
- minimum necessary PII only;
- PX7 remains authoritative for recommendation facts;
- no autonomous writes;
- no spirituality/personal-worth/sensitive-attribute inference;
- explicit human confirmation is required before any future write flow.

## Historical pilot status

KP1–KP8 and MP1–MP8 were integrated before the Product Experience reset. Historical pilot acceptance documents remain useful technical evidence, but they are **not the active backlog and do not certify the current Product Experience as final**.

The Product Experience master plan controls UI/UX and People priorities until explicitly superseded.

## Definition of done

For normal engineering work:

`ASSIGNED → IN PROGRESS → PR/REVIEW → INTEGRATED MAIN → RELEVANT GATES GREEN → PRODUCTION/UX VERIFIED → DONE`

For Product Experience tasks, the checkbox in `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` is controlled by the principal agent only.

A branch, commit, worker report, screenshot, preview deployment or green local test alone is not `DONE`.

## Ownership and branch discipline

- Principal/integration agent: source of truth, architecture decisions, code review, corrections, integration, production verification and checkbox completion.
- Worker agents: only explicitly scoped tasks; one branch per task/tightly coupled slice; no direct main commits; no merges; no force push.
- Workers must report the exact PX task ID and base main SHA.
- Parallel tasks must not edit the same product slice unless the principal deliberately coordinates them.
- Coordination issue #268 is the active multi-agent Product Experience queue.

## Non-negotiable engineering rules

- Preserve tenant isolation, capabilities, audit and domain events.
- Tenant/actor/capabilities are server-derived; never trust values supplied by frontend.
- Do not place unnecessary PII in logs, audit summaries, analytics, URLs, domain events or client storage.
- Private authenticated API responses must not be cached by the PWA/service worker.
- Every async UI surface needs real loading/empty/error/retry ownership where applicable.
- Prevent duplicate submissions and stale-response overwrites.
- pt-PT/en/es remain supported.
- WCAG 2.2 AA remains the minimum accessibility release floor.
- New Product Experience surfaces use Ant Design 6; do not expand legacy MUI simply because it still exists.
- Reuse existing People/organization/application contracts identified in the inventory before creating new backend behavior.

## What to do when starting a task

1. Fetch current `main` and record the SHA.
2. Read this file, the Product Experience master plan and the current inventory.
3. Select the exact unchecked PX task assigned to you.
4. Confirm no active branch is implementing the same slice.
5. Inspect current implementation and tests before assuming a feature is missing.
6. Create/update only the required branch.
7. Implement real production behavior, not placeholders.
8. Add tests and run the required gates.
9. Open/report the PR with task ID, base SHA, privacy/security impact and remaining work.
10. Leave the master checkbox unchecked; the principal updates it after integration and verification.
