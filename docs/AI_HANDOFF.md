# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-26 after C6 independent People-core acceptance and C7 master synchronization. Read this before taking any Eutaktos task. Historical pilot/worker reports may contain stale deployment, branch or priority information.

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
- **Accepted People-core product/runtime SHA: `f013f72722c18a6df06ad7c6390be668ed239dbf`**.
- C6 independent acceptance issue #319: **CLOSED / ACCEPTED** on 2026-08-26.
- C7 master synchronization began on docs-only main commit `5641b1dea7e626297e0e25d9fd398a594b710ba1`; always fetch current `main` before branching because documentation commits continue after the accepted runtime SHA.
- **Canonical production: `https://eutakes.netlify.app/`**
- `https://rainbow-zuccutto-00d981.netlify.app/` is not the production acceptance target.
- Vercel deployments are not Eutaktos production acceptance evidence.

## Current product decision

The integrated **People core composition is independently accepted** at `f013f727...`. This acceptance proves the current Overview, Directory, authorized Profile foundation, guided editor foundation, explainable recommendation flow, responsive behavior, themes/locales, security/privacy boundaries and related resilience gates that are checked in the master plan.

That does **not** mean every People master item is complete. The unchecked items in `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` remain authoritative product/contract gaps. In particular, ordinary profile contacts, some richer eligibility/assignment filtering/explanation, broader Wizard organization/availability coverage, PX7.8 manual constraints, PX8, PX9 and the remaining PX10/PX11 tasks are still open.

Eutaktos is an **organization assistant**, not a prettier CRUD application. It must:

- show what needs attention;
- explain why;
- guide the next action;
- provide deterministic, explainable candidate suggestions for assignments;
- preserve human decision-making;
- cover useful Hourglass People capabilities while making them simpler and safer.

## Current foundation status

### Integrated, independently accepted and principal-closed

- PX0 governance/source-of-truth inventory and historical-document cleanup: PRs #292/#293; PX0.1–PX0.6 complete.
- PX1 Ant Design 6 foundation/themes: PR #283 + PR #304; PX1.1–PX1.14 complete after independent #270 and final C6 evidence.
- PX2 task-oriented Ant shell/navigation: PR #291; PX2.1–PX2.6 complete.
- PX3 People Overview: authoritative overview/attention conditions complete through PRs #289/#300/#301 plus principal SHA `7592fb7f6ba5220b385871f812d03fd17f492bd5`; PX3.1–PX3.9 complete.
- PX4 Directory 2.0: PR #308 plus C5.1 routing integration; PX4.1–PX4.12 complete.
- C6 independent People-core acceptance: issue #319 closed, accepted product/runtime SHA `f013f72722c18a6df06ad7c6390be668ed239dbf`, with no open P0/P1/P2/P3 in that acceptance report.

### Integrated foundations with explicit remaining master gaps

- PX5 Unified Person Profile: completed shell/summary/availability/organization/history plus C5.7 contextual candidate insight. Still open: **PX5.3 ordinary phone/email/address contact contract/edit flow, PX5.4 full explanation of each participation/eligibility setting effect, PX5.6 full useful assignment filters**.
- PX6 Guided Add/Edit Person: completed Identity, Review, required/optional distinction, unsaved-change protection, double-submit guard, server authority, refresh persistence and shared edit mental model. Still open: **PX6.2 ordinary Contact contract, PX6.3 broader Organization/responsibility coverage, PX6.4 approved availability/absence participation flow**.
- PX7 deterministic explainable recommendations: PX7.1–PX7.7 and PX7.9–PX7.15 complete. **PX7.8 remains open** because a complete approved manual-exclusion/preference contract does not exist; do not invent one in the browser.
- PX10 quality evidence: C6 closes the master items explicitly checked there, but **real screen-reader acceptance, 200%/400% zoom, the write-capable update-availability walkthrough and final reference-quality closeout remain open**.
- Secure advisory administrator-AI server core: PR #288. The AI feature itself is not complete; it still depends on approved tools/evidence, frontend UI and its own acceptance.

### Important acceptance distinction

Integrated code and green CI remain necessary but not sufficient. The principal only checks Product Experience tasks when implementation, review, gates, integration and relevant production/UX evidence exist.

C6 acceptance is evidence for the accepted **current People core**. It must never be cited to erase an explicitly unchecked master task whose contract/UI behavior has not been implemented.

## UI component direction

The Product Experience rebuild uses **Ant Design 6** as the primary component foundation.

Migration is incremental:

1. Ant Design foundation/themes — accepted;
2. task-oriented shell/navigation — accepted;
3. People core patterns — implemented and independently accepted through C6;
4. close approved remaining People contract gaps and build PX8/PX9 using the proven patterns;
5. finish remaining PX10 evidence;
6. migrate remaining screens;
7. remove MUI only when no approved runtime consumer remains.

Do not create new Product Experience screens with MUI after the Ant foundation unless the principal explicitly approves a temporary migration exception.

Legacy MUI runtime consumers and the migration boundary are inventoried in `docs/PRODUCT_EXPERIENCE_INVENTORY.md`.

## Current priority order

The active sequence after C6/C7 synchronization is:

1. **Preserve the accepted People-core baseline** `f013f727...`; no regression or competing UI direction.
2. Close the explicit canonical-contract/UI gaps in PX5/PX6/PX7.8 **only when the required authoritative DTO/domain contract is approved**. Do not fabricate fields or constraints just to clear checkboxes.
3. **PX8 — responsible-person assistance** using reviewed PX7 evidence.
4. **PX9 — useful Hourglass People parity**, simplified and improved.
5. **Remaining PX10 evidence** — real screen-reader acceptance, 200%/400% zoom, full write-capable real-user walkthrough, then principal reference-quality decision.
6. **PX11 — remaining MUI retirement/migration** only after the relevant People patterns and acceptance are genuinely complete.

Do not skip ahead to broad feature expansion that bypasses the master-plan privacy, capability or evidence rules.

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

KP1–KP8 and MP1–MP8 were integrated before the Product Experience reset. Historical pilot acceptance documents remain useful technical evidence, but they are **not the active backlog and do not certify unchecked current Product Experience work**.

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
- Coordination issue #268 remains the multi-agent Product Experience queue unless the principal explicitly supersedes it.

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
- Recommendation is advisory evidence: human choice remains final; do not auto-assign merely because a person ranks first.

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
