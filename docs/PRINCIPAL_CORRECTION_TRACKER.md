# Principal Correction Tracker

Operational source of truth for the current Eutaktos People correction/integration cycle.

## Non-negotiable rules

1. Before every slice: refresh `main`; read this file, `docs/AI_HANDOFF.md`, and the relevant `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` section.
2. One correction/integration slice at a time. Never start from a worker report or stale branch without checking the actual SHA/diff.
3. Mark `[x]` only after: review/correction -> relevant gates green -> merge to current `main` -> canonical `netlify/eutakes` preview/production evidence where applicable.
4. Browser never supplies authoritative tenant/actor/capabilities. Preserve tenant isolation, least privilege, audit/domain boundaries and minimum PII.
5. No new Product Experience screen may introduce MUI.
6. No PII in URL/search, browser storage, logs, analytics, cache or unapproved export fields.
7. Do not create duplicate branches. Reuse the active branch when safe; close superseded PRs; merged branches should disappear through repository cleanup.
8. Every branch not explicitly ACTIVE below is historical/quarantined and must not be used as implementation source without individual verification.
9. Canonical acceptance URL: `https://eutakes.netlify.app/`.
10. `PRODUCT_EXPERIENCE_MASTER_PLAN.md` is synchronized only in C7 from integrated evidence, never from worker claims.

## Current integrated baseline

- PX3.4 + PX3.7: integrated at `7592fb7f6ba5220b385871f812d03fd17f492bd5`.
- PX4.11: PR #308 corrected/integrated at `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- PX6 guided editor **foundation**: PR #309 corrected/integrated at `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
- PX7 recommendation backend/domain **foundation**: PR #307 corrected/integrated at `58964b7c0080dd89b92459241de71ccdda111f6c`.
- PX5 unified person profile **foundation**: PR #305 corrected/integrated at `891369306414003dbea49371a02cff6c02c1c324`.
- The first implementation wave has no remaining active worker branch. C5 is now Principal integration work.

Important: foundation merge is not equivalent to full PX5/PX6/PX7 product closure.

## C0 — Repository hygiene and source of truth

- [x] **C0.1** Create Principal tracker.
- [x] **C0.2** Integrate tracker through PR #310.
- [x] **C0.3** Inventory branches: initial inventory was 85 total; unreviewed old branches classified `HISTORICAL-QUARANTINE`.
- [x] **C0.4** Close superseded open PRs: #303 closed without merge.
- [ ] **C0.5** Delete confirmed superseded historical branches when a real branch-delete action is available.
  - `principal/px4-11-bulk-export` / #303 remains `SUPERSEDED-DELETE`; never use it.
  - Never simulate deletion by force-moving refs.

## C1 — PX4.11 Directory export/bulk correction

- [x] C1.1–C1.6 complete.
- Final head: `3b6a7e92ff642d4157967fb39fccc9f8066e6b15`.
- CI run `32953527991`: `quality` PASS + `browser-regression` PASS.
- Canonical `netlify/eutakes/deploy-preview`: PASS.
- Merge SHA: `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- Principal corrections included real capability-aware UX harness data and a React filter-reference stability fix preventing bulk-selection render/update churn.
- Merged branch auto-deleted.

## C2 — PX6 guided editor foundation correction

- [x] C2.1–C2.8 complete.
- Final head: `400afcef5fad40f27062aaf5b2488192f46d4924`.
- CI run `32956000440`: `quality` PASS + `browser-regression` PASS.
- Canonical `netlify/eutakes/deploy-preview`: PASS.
- Merge SHA: `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
- Corrected optional-resource coupling, partial-save retries, ambiguous-create handling, 401/403 states, baseline ownership, domain name normalization, minimal PATCH behavior and concurrent membership/core lost-update risks.
- Known partial-create limitation remains: an ambiguous lost create response cannot be safely auto-retried until a server idempotency contract exists.
- `grok/px6-guided-person-editor` auto-deleted.
- **Still open for full PX6:** C5.2 real Directory wiring; ordinary Contact contract; general availability/responsibilities coverage where approved contracts exist.

## C3 — PX7 recommendation backend/domain correction

- [x] C3.1–C3.8 complete.
- Final head: `e97269ff5d52f8abbc52eaa92dff52d3e665f0c0`.
- CI run `32957109650`: `quality` PASS + `browser-regression` PASS.
- Canonical `netlify/eutakes/deploy-preview`: PASS.
- Merge SHA: `58964b7c0080dd89b92459241de71ccdda111f6c`.
- Canonical eligibility precedence: later `decidedAt` wins; on equal timestamp, later append-record wins. `decidedBy` has no business ordering meaning.
- Hard constraints verified before workload/recency; completed-only history; no-history remains neutral; tenant/capability isolation verified.
- Recommendation window now requires valid timezone-explicit ISO instants and `endsAt > startsAt`.
- `brunello/px7-complete` auto-deleted.
- **Still open for full PX7:** C5.4 localized reasons, C5.5 recommendation picker, C5.6 `Ver todos os elegíveis`.

## C4 — PX5 unified person profile foundation correction

- [x] **C4.1** Re-read canonical responsibility interval rules and PR #305 before editing.
- [x] **C4.2** Align active responsibilities to canonical `[startsAt, endsAt)` and fail closed on invalid timestamps.
- [x] **C4.3** Evaluate assignments using real `date + localTime + timezone`; same-day past meetings are not upcoming; Lisbon DST ambiguous/nonexistent times follow scheduling semantics/fail closed.
- [x] **C4.4** Preserve partial/401/403/404/retry/stale-response ownership behavior.
- [x] **C4.5** Preserve minimum PII: ordinary phone/email/address are not inferred without an approved DTO; audit is not requested without `audit.read`.
- [x] **C4.6** Reassess literal master requirements. PX5.3/PX5.4/PX5.6 remain PARTIAL; PX5.9 remains OPEN.
- [x] **C4.7** Validate against current main and rerun gates.
  - Final head: `91b03a9e1a1b8086869c5a11384d3bcb9472ccd0`.
  - Merge-ref tested against current main including C3/tracker updates.
  - CI run `32958989117`: `quality` PASS + `browser-regression` PASS.
  - Focused profile tests include responsibility boundaries, invalid timestamps, same-day meeting time, cross-timezone ordering, Lisbon DST ambiguity/nonexistent time, authorization and stale response ownership.
  - Canonical `netlify/eutakes/deploy-preview`: PASS.
  - An earlier generic Directory UX failure (`Add person` not found) passed on job rerun without Directory changes and the final head full browser suite also passed; treated as harness timing/flake, not hidden as a product fix.
- [x] **C4.8** Integrate corrected PX5 foundation.
  - PR #305 merged at `891369306414003dbea49371a02cff6c02c1c324` using expected head SHA.
  - `manus/px5-unified-person-profile` confirmed auto-deleted after merge.
- **Still open for full PX5:** C5.1 route/runtime integration; PX5.3 ordinary contacts/editing; PX5.4 explain what eligibility settings affect; PX5.6 useful assignment filters; PX5.9 contextual recommendation insight via C5.7.

## C5 — Principal People integration

Use one coherent Principal integration branch only; do not create a branch per checkbox.

- [ ] **C5.1** Directory -> Person Profile navigation/deep link without PII in URL. A stable opaque person ID is acceptable only after current routing/privacy contracts are reviewed.
- [ ] **C5.2** Add/Edit -> PX6 Wizard; retire old basic form only after replacement is proven.
- [ ] **C5.3** Add server-side PX7 adapter built solely from authenticated/authorized facts; browser must not supply tenant/actor/capabilities as authority.
- [ ] **C5.4** Add pt-PT/en/es localized PX7 reason/warning text.
- [ ] **C5.5** Build recommendation picker for assignment workflows.
- [ ] **C5.6** Add `Ver todos os elegíveis` escape hatch.
- [ ] **C5.7** Connect PX5.9 contextual candidate insight only to approved PX7 evidence.
- [ ] **C5.8** Run integrated quality/browser/security/privacy gates and canonical preview.

## C6 — Independent acceptance

- [ ] **C6.1** Give Manus 1.6 one integrated SHA/preview, not isolated worker branches.
- [ ] **C6.2** Validate 320/375/390/430/768/1024/1280/1440 where tooling permits.
- [ ] **C6.3** Validate Light/Dark/System, pt-PT/en/es, keyboard/focus, loading/error/empty/retry and horizontal overflow.
- [ ] **C6.4** Validate 401/403, stale-response ownership, double submit and PWA privacy.
- [ ] **C6.5** Resolve every P0/P1 before final People acceptance.

## C7 — Source-of-truth synchronization

- [ ] **C7.1** Update `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` only from integrated evidence.
- [ ] **C7.2** Record already Principal-accepted PX1 closure if still stale.
- [ ] **C7.3** Record PX3/PX4 completion from current evidence.
- [ ] **C7.4** Mark only genuinely completed PX5/PX6/PX7 items; leave contract/UI gaps unchecked.
- [ ] **C7.5** Record final main SHA and canonical production evidence.

## Branch hygiene register

| Branch / PR | State | Action |
|---|---|---|
| `main` | ACTIVE SOURCE OF TRUTH | Never rewrite/force-push |
| `principal/correction-tracker` / #310 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/px4-11-final` / #308 | MERGED / AUTO-DELETED | Do not recreate |
| `principal/px4-11-bulk-export` / #303 | SUPERSEDED-DELETE | Never use; delete only with real delete tooling |
| `grok/px6-guided-person-editor` / #309 | MERGED / AUTO-DELETED | Do not recreate |
| `brunello/px7-complete` / #307 | MERGED / AUTO-DELETED | Do not recreate |
| `manus/px5-unified-person-profile` / #305 | MERGED / AUTO-DELETED | Do not recreate |
| all other pre-existing branches | HISTORICAL-QUARANTINE | Never use in this cycle without individual verification |

No worker implementation branch from Wave 1 is active after C4.

## Completion record

- `2026-08-26 — C0 tracker/hygiene — PR #310 — initial branch inventory 85 — historical quarantine established`
- `2026-08-26 — C1 PX4.11 — PR #308 — merge 457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d — CI 32953527991 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C2 PX6 foundation — PR #309 — merge 6673cfcc14e89f5666a72941b3f44246a71ff5db — CI 32956000440 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C3 PX7 backend/domain foundation — PR #307 — merge 58964b7c0080dd89b92459241de71ccdda111f6c — CI 32957109650 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C4 PX5 profile foundation — PR #305 — merge 891369306414003dbea49371a02cff6c02c1c324 — final head 91b03a9e1a1b8086869c5a11384d3bcb9472ccd0 — CI 32958989117 PASS/PASS — canonical preview PASS — branch auto-deleted`
