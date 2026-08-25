# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-25 after the Product Experience reset. Read this before taking any Eutaktos task. Historical pilot/worker reports may contain stale deployment, branch or priority information.

## Mandatory reading order

Before coding, every principal or worker agent MUST read, in this order:

1. `docs/AI_HANDOFF.md` — current project/priority state.
2. `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` — active Product Experience requirements, task IDs, checkboxes and definition of done.
3. Any domain/security document directly relevant to the selected task.

No agent may invent a competing UI direction or begin an unchecked Product Experience task without first checking the master plan.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`
- Main baseline at the Product Experience reset: `be68797922b2a9f96b5fe47e906a95cdfbcf77cb`
- **Canonical production: `https://eutakes.netlify.app/`**
- `https://rainbow-zuccutto-00d981.netlify.app/` is not the production acceptance target.
- Vercel deployments are not Eutaktos production acceptance evidence.

Always fetch current `main` before starting work; the SHA above is a historical reset baseline, not permission to branch from a stale commit.

## Current product decision

The previous pilot work established a strong technical/domain/security foundation, but the current UX is not yet the product experience we want to ship.

The new highest priority is **Eutaktos Product Experience**, beginning with a complete rebuild of **Pessoas / People** as the reference module.

The goal is not a prettier CRUD application. Eutaktos must act as an organization assistant that:

- shows what needs attention;
- explains why;
- guides the next action;
- provides deterministic, explainable candidate suggestions for assignments;
- preserves human decision-making;
- covers useful Hourglass People capabilities while making them simpler and safer.

The full specification and active checklist are in:

`docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`

## UI component direction

The Product Experience rebuild uses **Ant Design 6** as the primary component foundation.

Migration is incremental:

1. establish Ant Design theme/design-token foundation;
2. rebuild application shell/navigation;
3. rebuild People end to end;
4. prove the new patterns;
5. migrate remaining screens;
6. remove MUI only when no approved runtime consumer remains.

Do not create new Product Experience screens with MUI after the Ant foundation is integrated unless the principal explicitly approves a temporary migration exception.

## Current priority order

1. PX0 — governance/source of truth/inventory.
2. PX1 — Ant Design foundation and functioning light/dark/system themes.
3. PX2 — task-oriented application shell/navigation.
4. PX3–PX6 — People Overview, Directory, unified Profile and guided Add/Edit.
5. PX7–PX8 — explainable assignment recommendations and responsible-person assistance.
6. PX9 — useful Hourglass People parity, simplified and improved.
7. PX10 — UX/accessibility/security/production acceptance.
8. PX11 — remaining MUI retirement after People proves the pattern.

Do not skip ahead to broad feature expansion while the reference People experience remains unfinished.

## Historical pilot status

KP1–KP8 and MP1–MP8 were integrated before this Product Experience reset. The old frontend queue was closed and the remaining pilot acceptance work was external real-world validation.

That historical work remains valid technical evidence. It is **not** permission to call the current product experience final.

The principal runtime/acceptance queue may remain open for historical acceptance tracking, but Product Experience is now the active development priority until the user explicitly changes it.

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

## Non-negotiable engineering rules

- Preserve tenant isolation, capabilities, audit and domain events.
- Tenant/actor/capabilities are server-derived; never trust values supplied by frontend.
- Do not place unnecessary PII in logs, audit summaries, analytics, URLs, domain events or client storage.
- Private authenticated API responses must not be cached by the PWA/service worker.
- Every async UI surface needs real loading/empty/error/retry ownership where applicable.
- Prevent duplicate submissions and stale-response overwrites.
- pt-PT/en/es remain supported.
- WCAG 2.2 AA remains the minimum accessibility release floor.

## What to do when starting a task

1. Fetch current `main`.
2. Read this file and the Product Experience master plan.
3. Select the exact unchecked PX task assigned to you.
4. Inspect current implementation and existing tests.
5. Create/update only the required branch.
6. Implement real production behavior, not placeholders.
7. Add tests and run the required gates.
8. Open/report the PR with task ID, base SHA, privacy/security impact and remaining work.
9. Leave the master checkbox unchecked; the principal updates it after integration and verification.
