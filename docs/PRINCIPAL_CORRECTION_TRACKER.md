# Principal Correction Tracker

Operational source of truth for the current Eutaktos People correction/integration cycle.

## Non-negotiable rules

1. Before every slice: refresh `main`; read this file, `docs/AI_HANDOFF.md`, and the relevant `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` section.
2. One correction/integration slice at a time. Never accept worker reports without checking actual SHA/diff.
3. Mark `[x]` only after review/correction -> relevant gates green -> merge to current `main` -> canonical `netlify/eutakes` evidence where applicable.
4. Browser never supplies authoritative tenant/actor/capabilities. Preserve tenant isolation, least privilege, audit/domain boundaries and minimum PII.
5. No new Product Experience screen may introduce MUI.
6. No PII in URL/search, browser storage, logs, analytics, cache or unapproved export fields.
7. Do not create duplicate branches. Merged branches should disappear through repository cleanup.
8. Every branch not explicitly ACTIVE below is historical/quarantined and must not be used without individual verification.
9. Canonical acceptance URL: `https://eutakes.netlify.app/`.
10. `PRODUCT_EXPERIENCE_MASTER_PLAN.md` is synchronized only in C7 from integrated evidence, never from worker claims.

## Current integrated baseline

- PX3.4 + PX3.7: `7592fb7f6ba5220b385871f812d03fd17f492bd5`.
- PX4.11 / PR #308: `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- PX6 guided editor foundation / PR #309: `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
- PX7 backend/domain foundation / PR #307: `58964b7c0080dd89b92459241de71ccdda111f6c`.
- PX5 unified profile foundation / PR #305: `891369306414003dbea49371a02cff6c02c1c324`.
- C5.1 Directory -> Profile / PR #311: `fcdf51f7317d893721dff79c3f4fc17f3e4a850d`.
- C5.2 Directory Add/Edit -> PX6 PersonWizard / PR #312: `495d21cc970ee2d5379d88fe2d99882a5e5ffe66`.
- C5.3 authenticated PX7 recommendation adapter / PR #313: `0c1fdb45c1bfbb4f4a26b9c671df845c9d592a6c`.
- C5.4 PX7 localized reason/warning copy / PR #314: `a9710362a672664d754ad615967038b08d98be6a`.
- C5.5 explainable recommendation picker / PR #315: `46665eab2218f4b806497b281732d4f8b56c69ec`.
- C5.6 all-eligible escape hatch / PR #316: `79407fd54230dc9f9b05edadc3cd767575d592b2`.

Foundation merge is not equivalent to full PX5/PX6/PX7 product closure.

## C0 — Repository hygiene and source of truth

- [x] C0.1–C0.4 tracker/source-of-truth/inventory/superseded PR handling complete.
- [ ] **C0.5** Delete confirmed superseded historical branches when a real branch-delete action is available.
  - `principal/px4-11-bulk-export` / #303 remains `SUPERSEDED-DELETE`; never use it.
  - Initial branch inventory: 85 total; unreviewed old branches remain `HISTORICAL-QUARANTINE`.
  - Never simulate deletion by force-moving refs.

## C1 — PX4.11 Directory export/bulk correction

- [x] C1.1–C1.6 complete.
- PR #308; final head `3b6a7e92ff642d4157967fb39fccc9f8066e6b15`; merge `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- CI `32953527991`: quality PASS + browser-regression PASS; canonical preview PASS.
- Capability-aware export/bulk and filter-reference stability regression fixed; branch auto-deleted.

## C2 — PX6 guided editor foundation correction

- [x] C2.1–C2.8 complete.
- PR #309; final head `400afcef5fad40f27062aaf5b2488192f46d4924`; merge `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
- CI `32956000440`: PASS/PASS; canonical preview PASS; branch auto-deleted.
- Corrected optional-resource coupling, partial-save retries, ambiguous-create handling, 401/403, baseline ownership, domain name normalization, minimal PATCH behavior and concurrent lost-update risks.
- Still open for full PX6: ordinary Contact contract and broader approved availability/responsibility coverage.

## C3 — PX7 recommendation backend/domain correction

- [x] C3.1–C3.8 complete.
- PR #307; final head `e97269ff5d52f8abbc52eaa92dff52d3e665f0c0`; merge `58964b7c0080dd89b92459241de71ccdda111f6c`.
- CI `32957109650`: PASS/PASS; canonical preview PASS; branch auto-deleted.
- Eligibility precedence, tenant/capability isolation, hard constraints, completed-only history and timezone-explicit recommendation window verified.
- PX7 backend + localized explainability + picker + all-eligible human-control surface are now integrated; master checkbox synchronization remains C7.

## C4 — PX5 unified person profile foundation correction

- [x] C4.1–C4.8 complete.
- PR #305; final head `91b03a9e1a1b8086869c5a11384d3bcb9472ccd0`; merge `891369306414003dbea49371a02cff6c02c1c324`.
- CI `32958989117`: PASS/PASS; canonical preview PASS; branch auto-deleted.
- Corrected canonical responsibility intervals, invalid timestamps, real date+time+timezone assignment ordering, DST behavior and authorization/stale-response handling.
- Still open for full PX5: ordinary contacts/editing; explain eligibility-setting impact; useful assignment filters; PX5.9 via C5.7.

## C5 — Principal People integration

- [x] **C5.1** Directory -> Person Profile navigation/deep link without PII in URL.
  - PR #311; final head `88ec2c337e1bca7d880f9e253ae2eddf94e31f40`; merge `fcdf51f7317d893721dff79c3f4fc17f3e4a850d`.
  - CI `32960668620`: PASS/PASS; dedicated route regression PASS; canonical preview PASS.
- [x] **C5.2** Add/Edit -> PX6 Wizard; legacy basic form retired after replacement proof.
  - PR #312; final head `278a10c0e29e34a1dfbbe91883fbbc4fa1c4640f`; merge `495d21cc970ee2d5379d88fe2d99882a5e5ffe66`.
  - CI `32962712469`: PASS/PASS; dedicated guided Add/Edit/read-only capability regression PASS; canonical preview PASS.
  - Write controls require server Directory `writePeople` plus authenticated session `people.read + people.write`; branch auto-deleted.
- [x] **C5.3** Server-side PX7 adapter built solely from authenticated/authorized facts.
  - PR #313; final head `9e6b67741120c3191ae6f4d4a98141d92f2d70cb`; squash merge `0c1fdb45c1bfbb4f4a26b9c671df845c9d592a6c`.
  - CI `32966364434`: quality PASS + browser-regression PASS; canonical `netlify/eutakes/deploy-preview` PASS.
  - New read-only contract: `GET /api/people/recommendations?meetingId=<opaque>&slotId=<opaque>`.
  - Browser supplies only opaque target identity. Unknown/authority-bearing fields, GET bodies, duplicate values and malformed refs are rejected.
  - Server resolves principal and requires `people.read`, `eligibility.read`, `availability.read`, `schedule.read` before loading tenant evidence.
  - Assignment type comes from stored slot `partDefinitionId`; window comes from stored meeting date/localTime/IANA timezone; people, explicit eligibility, availability, active assignments, completed history and workload are tenant-scoped server facts.
  - Reuses accepted `deterministicRecommendationEvidence`; no second ranking engine and no assignment write/automatic decision.
  - Response is minimized to target + structured PX7 evidence + authorized display name; tests prove no tenant/actor/capabilities/contact fields in public JSON.
  - 11 focused adapter/request-contract tests PASS; invalid user-selected target maps to 400 while stored-evidence corruption remains fail-loud internal error.
  - `principal/people-recommendation-integration` confirmed auto-deleted after merge.
- [x] **C5.4** Add pt-PT/en/es localized PX7 reason/warning text.
  - PR #314; final head `2c7b7fe2a56751662d3858692cf29c22ddfc97f8`; squash merge `a9710362a672664d754ad615967038b08d98be6a`.
  - CI `32967568203`: quality PASS + browser-regression PASS; canonical `netlify/eutakes/deploy-preview` PASS.
  - Presentation-only catalog covers all 11 current `RecommendationReasonCode` values and both `RecommendationWarningCode` values in `pt-PT`, `en`, `es`.
  - Type-only application imports plus exhaustive `Record<...>` typing make future engine codes fail typecheck until copy exists for all supported locales; no recommendation/ranking logic changed.
  - `LONGER_SINCE_LAST_ASSIGNMENT` preserves comparable completed-history semantics; `NO_COMPLETED_ASSIGNMENT_HISTORY` remains a neutral warning rather than positive evidence.
  - 9 focused localization tests PASS; `principal/c5-4-recommendation-i18n` confirmed auto-deleted after merge.
- [x] **C5.5** Build recommendation picker for assignment workflows.
  - PR #315; final head `b65a83d3932fd3784b39fe5dbb039bc7efa8f3eb`; squash merge `46665eab2218f4b806497b281732d4f8b56c69ec`.
  - CI `32970183672`: quality PASS + browser-regression PASS; canonical `netlify/eutakes/deploy-preview` PASS.
  - Ant Design 6 picker is integrated into new-student and student-replacement flows, using only the authenticated C5.3 target identity contract.
  - Displays the server-ranked top three with localized C5.4 reasons/warnings; browser does not calculate or repair ranking evidence.
  - Client rejects non-sequential ranks, duplicate identities and candidate/excluded identity overlap instead of reinterpreting malformed server evidence.
  - Browser regression proves recommendation selection binds to the actual assignment state, replacement reuses the picker, request inputs remain `meetingId + slotId` only under React StrictMode, person data does not enter URL/storage, and arbitrary role assignment does not call the unsupported student recommendation target.
  - Manual selector remains visible intentionally until C5.6 provides the explicit all-eligible escape hatch; `principal/c5-5-recommendation-picker` confirmed auto-deleted after merge.
- [x] **C5.6** Add `Ver todos os elegíveis` escape hatch.
  - PR #316; final head `942b63076a8ddcd106e84e03193d463d62c0bd03`; squash merge `79407fd54230dc9f9b05edadc3cd767575d592b2`.
  - CI `32971748866`: quality PASS + browser-regression PASS; canonical `netlify/eutakes/deploy-preview` PASS at `https://deploy-preview-316--eutakes.netlify.app`.
  - Default assignment/replacement surface stays on the server-ranked top three; `Ver todos os elegíveis` reveals only additional PX7 candidates in canonical server order.
  - Rank-4 selection is proven to bind to the real assignment state; browser never recalculates eligibility or rank.
  - Raw active-person selector is hidden by default and remains available only through explicit `Selecionar manualmente`, with disclosure that active status does not assert eligibility, availability or absence of conflict.
  - Recommendation requests remain identity-only `meetingId + slotId`; no person evidence is added to URL/storage; arbitrary role flow remains outside unsupported student targeting.
  - `principal/c5-6-all-eligible` confirmed auto-deleted after merge.
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
| `principal/c5-6-all-eligible` / #316 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/c5-5-recommendation-picker` / #315 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/people-integration` / #312 | MERGED / AUTO-DELETED | Do not reuse stale history |
| `principal/people-recommendation-integration` / #313 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/c5-4-recommendation-i18n` / #314 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/correction-tracker` / #310 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/px4-11-final` / #308 | MERGED / AUTO-DELETED | Do not recreate |
| `principal/px4-11-bulk-export` / #303 | SUPERSEDED-DELETE | Never use; delete only with real delete tooling |
| `grok/px6-guided-person-editor` / #309 | MERGED / AUTO-DELETED | Do not recreate |
| `brunello/px7-complete` / #307 | MERGED / AUTO-DELETED | Do not recreate |
| `manus/px5-unified-person-profile` / #305 | MERGED / AUTO-DELETED | Do not recreate |
| all other pre-existing branches | HISTORICAL-QUARANTINE | Never use in this cycle without individual verification |

No Wave 1 worker implementation branch is active.

## Completion record

- `2026-08-26 — C0 tracker/hygiene — PR #310 — initial branch inventory 85 — historical quarantine established`
- `2026-08-26 — C1 PX4.11 — PR #308 — merge 457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d — CI 32953527991 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C2 PX6 foundation — PR #309 — merge 6673cfcc14e89f5666a72941b3f44246a71ff5db — CI 32956000440 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C3 PX7 backend/domain foundation — PR #307 — merge 58964b7c0080dd89b92459241de71ccdda111f6c — CI 32957109650 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C4 PX5 profile foundation — PR #305 — merge 891369306414003dbea49371a02cff6c02c1c324 — CI 32958989117 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C5.1 Directory -> Profile — PR #311 — merge fcdf51f7317d893721dff79c3f4fc17f3e4a850d — CI 32960668620 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C5.2 Directory Add/Edit -> PersonWizard — PR #312 — merge 495d21cc970ee2d5379d88fe2d99882a5e5ffe66 — CI 32962712469 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C5.3 authenticated PX7 adapter — PR #313 — merge 0c1fdb45c1bfbb4f4a26b9c671df845c9d592a6c — final head 9e6b67741120c3191ae6f4d4a98141d92f2d70cb — CI 32966364434 PASS/PASS — 11 focused tests PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.4 PX7 reason localization — PR #314 — merge a9710362a672664d754ad615967038b08d98be6a — final head 2c7b7fe2a56751662d3858692cf29c22ddfc97f8 — CI 32967568203 PASS/PASS — 9 focused localization tests PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.5 recommendation picker — PR #315 — merge 46665eab2218f4b806497b281732d4f8b56c69ec — final head b65a83d3932fd3784b39fe5dbb039bc7efa8f3eb — CI 32970183672 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.6 all-eligible escape hatch — PR #316 — merge 79407fd54230dc9f9b05edadc3cd767575d592b2 — final head 942b63076a8ddcd106e84e03193d463d62c0bd03 — CI 32971748866 PASS/PASS — canonical preview PASS — branch auto-deleted`