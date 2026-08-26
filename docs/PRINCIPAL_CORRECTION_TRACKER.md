# Principal Correction Tracker

This file is the operational checklist for the current Eutaktos People correction/integration phase.

## Rules

1. Before starting **every correction**, refresh `main`, read this tracker, `docs/AI_HANDOFF.md`, and the relevant section of `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`.
2. Verify the exact PR/branch/head SHA before changing anything. Never work from a stale worker report.
3. One correction/integration slice at a time. Do not mix unrelated fixes in the same branch.
4. A checkbox becomes `[x]` only after: code reviewed/corrected -> relevant tests green -> PR integrated into current `main` -> canonical `netlify/eutakes` evidence green when applicable.
5. Worker PR text is evidence to inspect, never proof of DONE by itself.
6. Do not trust browser-provided tenant/actor/capabilities. Preserve least privilege and tenant isolation.
7. No new Product Experience screen may introduce MUI.
8. Do not place PII in URLs, storage, logs, analytics, cache, audit payloads, test fixtures committed as real data, or exported fields without an approved contract.
9. Do not create a replacement branch when an existing current branch can be safely corrected. If a stale branch must be superseded, close its PR and record the replacement here.
10. Keep the repository clean: close superseded PRs, avoid duplicate implementation branches, and delete merged/superseded branches when branch-deletion tooling is available. Never delete an active worker branch before its accepted work is safely integrated.
11. Canonical production acceptance URL: `https://eutakes.netlify.app/`.
12. After each completed correction, update this file with the final main SHA, PR, gates and short evidence note.
13. During this correction cycle, **only branches explicitly listed as ACTIVE in this file may be used as an implementation source**. Every other pre-existing branch is historical/quarantined until individually proven safe to delete.

## Current baseline

- Baseline `main` when this tracker was created: `7592fb7f6ba5220b385871f812d03fd17f492bd5`.
- PX3.4 + PX3.7: integrated in `7592fb7f6ba5220b385871f812d03fd17f492bd5`.
- Superseded PX4.11 PR `#303`: CLOSED WITHOUT MERGE.
- Active implementation PRs at tracker creation:
  - `#308` — Principal PX4.11 final export/bulk slice.
  - `#305` — Manus PX5 Unified Person Profile foundation.
  - `#309` — Grok PX6 Guided Add/Edit Person.
  - `#307` — Brunello PX7 recommendation/domain slice.
- Repository branch inventory on 2026-08-26: **85 total branches** (`main` plus 84 slash-named branches).
- Current correction-cycle active set: **6 branches total** — `main`, `principal/correction-tracker`, `principal/px4-11-final`, `manus/px5-unified-person-profile`, `grok/px6-guided-person-editor`, `brunello/px7-complete`.
- The remaining **79 branches are HISTORICAL-QUARANTINE** for this cycle. They are not implementation sources. They may be deleted only after individual merge/supersession verification.
- Open PR inventory at the same checkpoint: only `#310`, `#308`, `#305`, `#309`, `#307`; all are current/active. No other open PR needs immediate closure.

## Correction order

### C0 — Repository hygiene and source of truth

- [x] **C0.1** Create this principal correction tracker on an isolated branch.
  - Branch: `principal/correction-tracker`
  - Created from main: `7592fb7f6ba5220b385871f812d03fd17f492bd5`
- [ ] **C0.2** Integrate this tracker into `main` after its PR/gates are acceptable.
- [x] **C0.3** Inventory active principal/worker branches and classify the correction-cycle source set.
  - 85 total branches.
  - 6 ACTIVE source branches for this cycle.
  - 79 HISTORICAL-QUARANTINE branches; never use them as a base without explicit reclassification.
- [x] **C0.4** Check all open PRs and close any superseded open PRs.
  - Open PRs are only #310/#308/#305/#309/#307 and all are active.
  - Superseded #303 was already closed without merge.
- [ ] **C0.5** Remove merged/superseded branches when deletion tooling is available; until then, record them explicitly so they are never mistaken for current work.
  - Current connector exposes branch create/update/search but no branch-delete action. Do not fake cleanup by moving refs or force-updating them.

### C1 — PX4.11 final Directory export/bulk integration

- [ ] **C1.1** Re-read current main Directory, PR #308 diff and browser failure log before editing.
- [ ] **C1.2** Fix the browser-regression failure without weakening the actual Directory behavior or accessibility.
  - Known failure at tracker creation: `test:ux-runtime` timed out opening localized `Nova pessoa` in pt-PT on PR #308 merge ref.
- [ ] **C1.3** Re-run/confirm quality, unit, build, bundle, PWA privacy and browser-regression gates.
- [ ] **C1.4** Confirm canonical `netlify/eutakes` preview success.
- [ ] **C1.5** Integrate #308 only after all relevant gates are green.
- [ ] **C1.6** Record final main SHA and close/delete superseded PX4 branches where safe.

### C2 — PX6 principal review and correction

- [ ] **C2.1** Review PR #309 line-by-line against current main and PX6.1-PX6.11.
- [ ] **C2.2** Verify create/edit uses authoritative existing contracts only.
- [ ] **C2.3** Verify double-submit/single-flight behavior under delayed/failed requests.
- [ ] **C2.4** Verify partial-create retry cannot duplicate a person and document the unavoidable ambiguous-response limitation until a server idempotency contract exists.
- [ ] **C2.5** Verify organization/eligibility writes cannot cross tenant/capability boundaries.
- [ ] **C2.6** Verify unsaved-change protection does not trap normal navigation or create PII browser state.
- [ ] **C2.7** Correct any defects found, update onto current main, and rerun relevant gates.
- [ ] **C2.8** Integrate accepted PX6 foundation and record final main SHA.

### C3 — PX7 recommendation contract correction

- [ ] **C3.1** Re-read current domain + transport eligibility semantics before editing PR #307.
- [ ] **C3.2** Remove semantic divergence for eligibility decisions sharing the same `decidedAt`.
  - Current defect: domain PR uses `decidedBy` tie-break, while transport/current decision selection uses timestamp only.
  - Required outcome: one canonical deterministic rule used everywhere, with explicit tests. Do not silently invent business meaning from actor ID ordering.
- [ ] **C3.3** Verify hard constraints remain hard: inactive, explicit ineligibility, away, conflict, required responsibility.
- [ ] **C3.4** Verify completed-only recency, no-history warning and deterministic ranking.
- [ ] **C3.5** Verify tenant/capability isolation with adversarial tests.
- [ ] **C3.6** Rebase/reapply accepted domain/application changes on current main and rerun gates.
- [ ] **C3.7** Integrate only the accepted PX7 backend/domain foundation and record final main SHA.
- [ ] **C3.8** Keep PX7.13/PX7.14/PX7.15 OPEN until UI localization, picker and `Ver todos os elegíveis` are actually integrated.

### C4 — PX5 Person Profile correction

- [ ] **C4.1** Re-read canonical responsibility interval rules and PR #305 helper before editing.
- [ ] **C4.2** Fix active responsibility semantics to match canonical `[startsAt, endsAt)` behavior and reject/contain invalid timestamps instead of treating them as active.
- [ ] **C4.3** Fix upcoming assignment evaluation to use meeting `date + localTime + timezone`, including same-day past meetings and DST-safe behavior.
- [ ] **C4.4** Verify partial/401/403/404/retry/stale-response behavior remains correct.
- [ ] **C4.5** Verify profile sections do not infer ordinary phone/email/address where no authorized DTO exists.
- [ ] **C4.6** Reassess PX5.3, PX5.4 and PX5.6 against literal master-plan acceptance; do not mark them DONE merely because a shell exists.
- [ ] **C4.7** Rebase/reapply accepted PX5 foundation on current main and rerun gates.
- [ ] **C4.8** Integrate corrected PX5 foundation and record final main SHA.

### C5 — Principal People integration

- [ ] **C5.1** Integrate Directory -> Person Profile navigation/deep-link behavior without putting PII in the URL.
- [ ] **C5.2** Integrate Add/Edit -> PX6 Wizard and remove/retire the obsolete basic form path only after replacement is proven.
- [ ] **C5.3** Add server-side PX7 adapter that builds recommendation input from authorized facts; browser must not supply authority-bearing tenant/actor/capabilities.
- [ ] **C5.4** Add pt-PT/en/es localized recommendation reason/warning text (PX7.13).
- [ ] **C5.5** Build recommendation picker used by assignment workflows (PX7.14).
- [ ] **C5.6** Add `Ver todos os elegíveis` escape hatch (PX7.15).
- [ ] **C5.7** Connect PX5.9 contextual candidate insight only to approved PX7 evidence.
- [ ] **C5.8** Run integrated browser/security/privacy gates.

### C6 — Independent acceptance

- [ ] **C6.1** Send one integrated SHA/preview to Manus 1.6 for independent QA; do not ask it to approve isolated worker branches as final acceptance.
- [ ] **C6.2** Validate 320/375/390/430/768/1024/1280/1440 where tooling permits.
- [ ] **C6.3** Validate Light/Dark/System, pt-PT/en/es, keyboard/focus, loading/error/empty/retry and no horizontal overflow.
- [ ] **C6.4** Validate 401/403, stale-response ownership, double submit and PWA privacy.
- [ ] **C6.5** Resolve every P0/P1 before final People acceptance.

### C7 — Source-of-truth synchronization

- [ ] **C7.1** Update `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` only from evidence integrated in main.
- [ ] **C7.2** Record PX1 closure evidence already accepted by Principal if still stale in the file.
- [ ] **C7.3** Record PX3/PX4 completion only after current final evidence is integrated.
- [ ] **C7.4** Mark only genuinely completed PX5/PX6/PX7 items; leave contract/UI gaps unchecked.
- [ ] **C7.5** Record final main SHA and canonical production evidence.

## Branch hygiene register

Use this table before creating any new branch.

| Branch / PR | State | Action |
|---|---|---|
| `main` | ACTIVE SOURCE OF TRUTH | Never rewrite/force-push |
| `principal/correction-tracker` / #310 | ACTIVE until tracker integrated | Merge once, then delete branch when tooling permits |
| `principal/px4-11-final` / #308 | ACTIVE | Correct and integrate; then delete branch |
| `principal/px4-11-bulk-export` / #303 | SUPERSEDED-DELETE | PR already closed; branch is not a source; delete when tooling permits |
| `manus/px5-unified-person-profile` / #305 | ACTIVE WORKER DELIVERY | Preserve until corrected/integrated |
| `grok/px6-guided-person-editor` / #309 | ACTIVE WORKER DELIVERY | Preserve until corrected/integrated |
| `brunello/px7-complete` / #307 | ACTIVE WORKER DELIVERY | Preserve until corrected/integrated |
| all other 79 pre-existing branches | HISTORICAL-QUARANTINE | Never use as source in this cycle; verify individually before deletion |

Historical/quarantined branches must not be deleted solely by name. Before deletion, verify they are merged/superseded and contain no unintegrated accepted work.

## Completion record

Append one short entry after each integrated correction:

- `2026-08-26 — C0.1/C0.3/C0.4 — PR #310 — branch inventory 85 total / active source set 6 / open PR set 5 — branch deletion pending connector support`
- `YYYY-MM-DD — Cx.y — PR #___ — main SHA ___ — gates ___ — canonical preview/prod ___`
