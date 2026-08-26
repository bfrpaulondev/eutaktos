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
- PX4.11: integrated through PR `#308` at main SHA `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d` after principal corrections and green gates.
- PX6 guided editor foundation: corrected and integrated through PR `#309` at main SHA `6673cfcc14e89f5666a72941b3f44246a71ff5db`. This is **not full PX6 product closure**; Directory wiring and missing Contact/availability/responsibility contracts remain open.
- Tracker: integrated through PR `#310`; main advanced to `eaba19b59d8d849b09d360060fe3fb8d3e1aa902` before later evidence updates.
- Superseded PX4.11 PR `#303`: CLOSED WITHOUT MERGE.
- Active worker implementation PRs after C2:
  - `#305` — Manus PX5 Unified Person Profile foundation.
  - `#307` — Brunello PX7 recommendation/domain slice.
- Repository branch inventory at tracker creation on 2026-08-26: **85 total branches** (`main` plus 84 slash-named branches).
- Merged correction branches `principal/correction-tracker`, `principal/px4-11-final` and `grok/px6-guided-person-editor` were automatically deleted by repository merge cleanup.
- `principal/px4-11-bulk-export` / closed PR `#303` still exists and remains `SUPERSEDED-DELETE`; never use it as an implementation source.
- All other pre-existing branches remain `HISTORICAL-QUARANTINE` unless this tracker explicitly reclassifies them.

## Correction order

### C0 — Repository hygiene and source of truth

- [x] **C0.1** Create this principal correction tracker on an isolated branch.
  - Original branch: `principal/correction-tracker`.
  - Created from main: `7592fb7f6ba5220b385871f812d03fd17f492bd5`.
- [x] **C0.2** Integrate this tracker into `main` after its PR/gates are acceptable.
  - PR `#310` merged after quality + browser-regression + canonical `netlify/eutakes` preview PASS.
  - Merge SHA: `eaba19b59d8d849b09d360060fe3fb8d3e1aa902`.
  - Merged tracker branch was automatically deleted.
- [x] **C0.3** Inventory active principal/worker branches and classify the correction-cycle source set.
  - 85 total branches at the initial inventory.
  - Only explicitly registered active branches may be used as correction sources.
  - Historical branches are quarantined rather than deleted blindly.
- [x] **C0.4** Check all open PRs and close any superseded open PRs.
  - Superseded `#303` was closed without merge.
  - After C2, current worker PRs are `#305` and `#307`; `#309` is merged.
- [ ] **C0.5** Remove merged/superseded branches when deletion tooling is available; until then, record them explicitly so they are never mistaken for current work.
  - Repository automatically deleted the merged `principal/correction-tracker`, `principal/px4-11-final` and `grok/px6-guided-person-editor` branches.
  - `principal/px4-11-bulk-export` still exists and is quarantined as superseded.
  - Current connector has no branch-delete action. Do not fake cleanup by force-moving refs.

### C1 — PX4.11 final Directory export/bulk integration

- [x] **C1.1** Re-read current main Directory, PR #308 diff and browser failure log before editing.
  - Initial failure was the localized Add Person UX runtime timing out after Directory moved to the `people-directory-v1` capability contract.
  - Follow-up failure exposed a real state-stability problem in bulk selection.
- [x] **C1.2** Fix the browser-regression failure without weakening the actual Directory behavior or accessibility.
  - Updated the legacy UX harness to provide the real server-derived `people-directory-v1` projection with `writePeople` capability instead of bypassing capability checks.
  - Fixed `sanitizePeopleDirectoryFilters()` so already-sanitized frozen filter state preserves reference identity; this prevents filtered-list recreation from driving the selection-pruning effect into a render/update loop.
  - Added a regression assertion that unchanged normalized filters preserve their stable reference.
  - Product `writePeople` gating, tenant authority and privacy constraints remain intact.
- [x] **C1.3** Re-run/confirm quality, unit, build, bundle, PWA privacy and browser-regression gates.
  - Final PR head: `3b6a7e92ff642d4157967fb39fccc9f8066e6b15`.
  - GitHub Actions run `32953527991`.
  - `quality`: PASS.
  - `browser-regression`: PASS.
  - The browser suite includes unit tests, bundle budget, PWA privacy, production mount, localized UX runtime and People Directory export/bulk runtime.
- [x] **C1.4** Confirm canonical `netlify/eutakes` preview success.
  - `netlify/eutakes/deploy-preview`: PASS for the final PR head.
  - Non-canonical Vercel rate-limit failures are not production acceptance evidence.
- [x] **C1.5** Integrate #308 only after all relevant gates are green.
  - PR `#308` merged successfully.
  - Integration main SHA: `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- [x] **C1.6** Record final main SHA and close/delete superseded PX4 branches where safe.
  - Accepted PX4.11 integration SHA: `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
  - `principal/px4-11-final` was auto-deleted after merge.
  - Superseded PR `#303` remains closed without merge; its branch remains quarantined pending a real branch-delete tool.

### C2 — PX6 principal review and correction

- [x] **C2.1** Review PR #309 line-by-line against current main and PX6.1-PX6.11.
  - Reviewed the five-step Ant wizard, model, optional resource steps, review UI, CSS, test discovery and mutation composition against current People/Organization/Eligibility contracts.
  - GitHub merge-ref verified the final PR head against current `main`, not only the stale base SHA recorded when the worker opened the PR.
- [x] **C2.2** Verify create/edit uses authoritative existing contracts only.
  - No phone/email/address, general availability or responsibility contract was invented.
  - Display-name validation now matches domain normalization (`trim`, collapse whitespace, 2-120 chars).
  - Core refetch verifies server-confirmed values; optional sections are read/written only when the user actually changes them.
  - Edit PATCH sends only the core fields the user changed, preserving unrelated concurrent server changes.
- [x] **C2.3** Verify double-submit/single-flight behavior under delayed/failed requests.
  - Synchronous mutation guard remains in front of the async save path.
  - Busy state disables navigation/save while a request is active.
  - Regression coverage proves a second submit does not invoke the mutation while the first is pending.
- [x] **C2.4** Verify partial-create retry cannot duplicate a person and document the unavoidable ambiguous-response limitation until a server idempotency contract exists.
  - A known partial create with a server-confirmed person ID resumes without a second POST.
  - Organization and eligibility retries fresh-read and skip already-applied writes.
  - If a create POST has a retryable failure before the client receives a confirmed person ID, the outcome is explicitly treated as ambiguous and automatic retry is blocked to avoid a possible duplicate.
  - True automatic recovery from a lost create response remains impossible until the server exposes an idempotency contract; this limitation remains open product architecture, not hidden by the UI.
- [x] **C2.5** Verify organization/eligibility writes cannot cross tenant/capability boundaries.
  - Browser never sends tenant/actor/capability authority in mutation payloads; existing APIs remain server authoritative.
  - Organization uses People read/write application capability checks; eligibility writes require the explicit eligibility write path and UI additionally requires a readable authoritative eligibility baseline.
  - Membership mutations are deltas against fresh authorized reads, so unrelated concurrent memberships are not removed.
- [x] **C2.6** Verify unsaved-change protection does not trap normal navigation or create PII browser state.
  - Browser history stores only a random non-PII wizard marker; draft/name/person IDs are not stored in URL/localStorage/sessionStorage/history state.
  - Back with a dirty draft restores the wizard before showing discard confirmation; clean exit removes/releases the marker before closing.
  - Full browser UX acceptance of this wizard remains deferred until C5.2 wires it into the real Directory flow.
- [x] **C2.7** Correct any defects found, update onto current main, and rerun relevant gates.
  - Corrected optional-resource coupling, partial-save retries, ambiguous create handling, 401/403 resource states, baseline retry ownership, domain identity normalization, partial PATCH behavior and concurrent membership/core lost-update risks.
  - Final head: `400afcef5fad40f27062aaf5b2488192f46d4924`.
  - PR merge-ref: `cc5011738c783789597c3c2213c1b55c3a2135f5`, explicitly `Merge 400afcef... into 2beb9d8...`.
  - GitHub Actions run `32956000440`: `quality` PASS + `browser-regression` PASS.
  - Canonical `netlify/eutakes/deploy-preview`: PASS.
- [x] **C2.8** Integrate accepted PX6 foundation and record final main SHA.
  - PR `#309` merged successfully at main SHA `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
  - `grok/px6-guided-person-editor` was automatically deleted after merge.
  - **Do not mark full PX6 DONE.** This merge is an isolated, corrected foundation. C5.2 must still wire Add/Edit to the wizard, and literal PX6 product coverage still lacks ordinary Contact fields, general availability and responsibilities because approved contracts do not yet exist.

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
- [ ] **C4.2** Fix active responsibility semantics to match canonical `[startsAt, endsAt)` behavior and reject/contain invalid timestamps instead of treatinging them as active.
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

Consult this table before creating or reusing any branch.

| Branch / PR | State | Action |
|---|---|---|
| `main` | ACTIVE SOURCE OF TRUTH | Never rewrite/force-push |
| `principal/correction-tracker` / #310 | MERGED / AUTO-DELETED | Do not recreate solely for checkbox updates |
| `principal/px4-11-final` / #308 | MERGED / AUTO-DELETED | PX4.11 source accepted; do not recreate |
| `principal/px4-11-bulk-export` / #303 | SUPERSEDED-DELETE | PR closed without merge; never use as source; delete when tooling permits |
| `grok/px6-guided-person-editor` / #309 | MERGED / AUTO-DELETED | Corrected PX6 foundation accepted; do not recreate |
| `manus/px5-unified-person-profile` / #305 | ACTIVE WORKER DELIVERY | Preserve until corrected/integrated |
| `brunello/px7-complete` / #307 | ACTIVE WORKER DELIVERY | Preserve until corrected/integrated |
| all other pre-existing branches | HISTORICAL-QUARANTINE | Never use as source in this cycle; verify individually before deletion |

Historical/quarantined branches must not be deleted solely by name. Before deletion, verify they are merged/superseded and contain no unintegrated accepted work.

## Completion record

- `2026-08-26 — C0.1/C0.3/C0.4 — PR #310 — branch inventory 85 total / initial active source set 6 / historical quarantine established`
- `2026-08-26 — C0.2 — PR #310 — merge SHA eaba19b59d8d849b09d360060fe3fb8d3e1aa902 — quality PASS / browser-regression PASS / canonical eutakes preview PASS — merged branch auto-deleted`
- `2026-08-26 — C1.1-C1.6 — PR #308 — integration SHA 457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d — CI run 32953527991 quality PASS + browser-regression PASS — canonical eutakes preview PASS — merged branch auto-deleted`
- `2026-08-26 — C2.1-C2.8 — PR #309 — integration SHA 6673cfcc14e89f5666a72941b3f44246a71ff5db — final head 400afcef5fad40f27062aaf5b2488192f46d4924 — CI run 32956000440 quality PASS + browser-regression PASS — canonical eutakes preview PASS — corrected foundation only; C5.2 and missing contracts remain open — merged branch auto-deleted`
- `YYYY-MM-DD — Cx.y — PR #___ — main SHA ___ — gates ___ — canonical preview/prod ___`
