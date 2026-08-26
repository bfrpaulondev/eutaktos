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
10. `PRODUCT_EXPERIENCE_MASTER_PLAN.md` is synchronized only from integrated/accepted evidence, never from worker claims.

## Current integrated baseline

- PX3.4 + PX3.7 authoritative attention contracts: `7592fb7f6ba5220b385871f812d03fd17f492bd5`.
- PX4.11 / PR #308: `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- PX6 guided editor foundation / PR #309: `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
- PX7 backend/domain foundation / PR #307: `58964b7c0080dd89b92459241de71ccdda111f6c`.
- PX5 unified profile foundation / PR #305: `891369306414003dbea49371a02cff6c02c1c324`.
- C5.1 Directory -> Profile / PR #311: `fcdf51f7317d893721dff79c3f4fc17f3e4a850d`.
- C5.2 Directory Add/Edit -> PX6 PersonWizard / PR #312: `495d21cc970ee2d5379d88fe2d99882a5e5ffe66`.
- C5.3 authenticated PX7 adapter / PR #313: `0c1fdb45c1bfbb4f4a26b9c671df845c9d592a6c`.
- C5.4 localized reason/warning copy / PR #314: `a9710362a672664d754ad615967038b08d98be6a`.
- C5.5 explainable recommendation picker / PR #315: `46665eab2218f4b806497b281732d4f8b56c69ec`.
- C5.6 all-eligible escape hatch / PR #316: `79407fd54230dc9f9b05edadc3cd767575d592b2`.
- C5.7 profile candidate insight / PR #317: `57f509e870c240e0d187d7eadd4aa1efbf93423b`.
- C6 recommendation production-route correction: `401c64675a6e299299d796d48989d63474f9ddd0`.
- C6 responsive closure / PR #321: `f013f72722c18a6df06ad7c6390be668ed239dbf`.
- **Accepted People-core product/runtime SHA: `f013f72722c18a6df06ad7c6390be668ed239dbf`.** Independent issue #319 verdict: `ACCEPT / C6 READY TO CLOSE`; issue closed completed.

Foundation/core acceptance is not equivalent to every People master-plan capability being complete. The explicit PX5/PX6/PX7/PX10 gaps retained in the master remain real after C7; PX8/PX9/PX11 remain future product work.

## C0 — Repository hygiene and source of truth

- [x] **C0.1–C0.4** Tracker/source-of-truth/inventory/superseded PR handling complete.
- [ ] **C0.5** Delete confirmed superseded historical branches when a real branch-delete action is available.
  - `principal/px4-11-bulk-export` / #303 remains `SUPERSEDED-DELETE`; never use it.
  - Initial branch inventory: 85 total; unreviewed old branches remain `HISTORICAL-QUARANTINE`.
  - Never simulate deletion by force-moving refs.

## C1 — PX4.11 Directory export/bulk correction

- [x] **C1.1–C1.6** Complete.
- PR #308; final head `3b6a7e92ff642d4157967fb39fccc9f8066e6b15`; merge `457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d`.
- CI `32953527991`: quality PASS + browser-regression PASS; canonical preview PASS; branch auto-deleted.

## C2 — PX6 guided editor foundation correction

- [x] **C2.1–C2.8** Complete.
- PR #309; final head `400afcef5fad40f27062aaf5b2488192f46d4924`; merge `6673cfcc14e89f5666a72941b3f44246a71ff5db`.
- CI `32956000440`: PASS/PASS; canonical preview PASS; branch auto-deleted.
- Fixed optional-resource coupling, partial-save retries, ambiguous-create handling, 401/403, baseline ownership, name normalization, minimal PATCH semantics and concurrent lost-update risks.
- Still open in the master for full PX6: ordinary Contact contract and broader approved responsibility/availability coverage.

## C3 — PX7 recommendation backend/domain correction

- [x] **C3.1–C3.8** Complete.
- PR #307; final head `e97269ff5d52f8abbc52eaa92dff52d3e665f0c0`; merge `58964b7c0080dd89b92459241de71ccdda111f6c`.
- CI `32957109650`: PASS/PASS; canonical preview PASS; branch auto-deleted.
- Eligibility precedence, tenant/capability isolation, hard constraints, completed-only history and timezone-explicit recommendation window verified.

## C4 — PX5 unified person profile foundation correction

- [x] **C4.1–C4.8** Complete.
- PR #305; final head `91b03a9e1a1b8086869c5a11384d3bcb9472ccd0`; merge `891369306414003dbea49371a02cff6c02c1c324`.
- CI `32958989117`: PASS/PASS; canonical preview PASS; branch auto-deleted.
- Fixed canonical responsibility intervals, invalid timestamps, real date+time+timezone ordering, DST behavior and authorization/stale-response handling.
- Still open in the master for full PX5: ordinary contacts/editing, full eligibility-setting explanation and useful assignment filters.

## C5 — Principal People integration

- [x] **C5.1** Directory -> Person Profile navigation/deep link without PII in URL.
  - PR #311; final head `88ec2c337e1bca7d880f9e253ae2eddf94e31f40`; merge `fcdf51f7317d893721dff79c3f4fc17f3e4a850d`; CI `32960668620` PASS/PASS; canonical preview PASS.
- [x] **C5.2** Add/Edit -> PX6 Wizard; legacy basic form retired after replacement proof.
  - PR #312; final head `278a10c0e29e34a1dfbbe91883fbbc4fa1c4640f`; merge `495d21cc970ee2d5379d88fe2d99882a5e5ffe66`; CI `32962712469` PASS/PASS; canonical preview PASS.
- [x] **C5.3** Server-side PX7 adapter built solely from authenticated/authorized facts.
  - PR #313; final head `9e6b67741120c3191ae6f4d4a98141d92f2d70cb`; merge `0c1fdb45c1bfbb4f4a26b9c671df845c9d592a6c`; CI `32966364434` PASS/PASS; 11 focused adapter/contract tests PASS; canonical preview PASS.
  - Public contract is read-only `GET /api/people/recommendations?meetingId=<opaque>&slotId=<opaque>`; server resolves principal, capabilities, tenant evidence, assignment type and meeting window.
- [x] **C5.4** Add pt-PT/en/es localized PX7 reason/warning text.
  - PR #314; final head `2c7b7fe2a56751662d3858692cf29c22ddfc97f8`; merge `a9710362a672664d754ad615967038b08d98be6a`; CI `32967568203` PASS/PASS; 9 focused localization tests PASS; canonical preview PASS.
- [x] **C5.5** Build recommendation picker for assignment workflows.
  - PR #315; final head `b65a83d3932fd3784b39fe5dbb039bc7efa8f3eb`; merge `46665eab2218f4b806497b281732d4f8b56c69ec`; CI `32970183672` PASS/PASS; canonical preview PASS.
  - Ant Design picker uses only the C5.3 target-identity contract, preserves server rank and exposes localized reasons/warnings without browser-side scoring.
- [x] **C5.6** Add `Ver todos os elegíveis` escape hatch.
  - PR #316; final head `942b63076a8ddcd106e84e03193d463d62c0bd03`; merge `79407fd54230dc9f9b05edadc3cd767575d592b2`; CI `32971748866` PASS/PASS; canonical preview PASS.
  - Default surface stays on top-three server-ranked candidates; additional PX7 candidates remain available in canonical order; manual active-person override is explicit and does not claim eligibility.
- [x] **C5.7** Connect PX5.9 contextual candidate insight only to approved PX7 evidence.
  - PR #317; final head `088b231a96d478c285538ba83b21461e8249ec61`; squash merge `57f509e870c240e0d187d7eadd4aa1efbf93423b`.
  - PR CI `32974585573`: quality PASS + browser-regression PASS; canonical `netlify/eutakes/deploy-preview` PASS.
  - Profile checks at most four chronological future, student-capable, unassigned targets and only shows positive candidate evidence returned by C5.3; missing capabilities prevent calls, and partial failure is never converted into a negative recommendation.
  - Browser runtime proves Directory -> Profile insight, localized evidence, identity-only `meetingId + slotId` requests, refresh, Back/Forward and privacy-safe URL behavior.
  - `principal/c5-7-profile-candidate-insight` confirmed auto-deleted after merge.
- [x] **C5.8** Run integrated quality/browser/security/privacy gates and canonical preview.
  - Integrated C5 product SHA: `57f509e870c240e0d187d7eadd4aa1efbf93423b`.
  - Main push CI `32974975422`: quality PASS + browser-regression PASS on the integrated `main` composition.
  - Browser regression includes typecheck, 354 unit tests, bundle budget, PWA privacy, production mount, UX runtime, Person Profile route + C5.7 insight, PersonWizard Directory, recommendation picker + all-eligible behavior, Directory export, System theme, lazy recovery, sanitized visual regression and Hourglass inspector.
  - Canonical `netlify/eutakes` PR preview for the final C5 product slice (#317) PASS.

## C6 — Independent acceptance

- [x] **C6.1** Give Manus 1.6 one integrated SHA/production composition, not isolated worker branches.
  - Final closure validated canonical production aligned exactly to accepted product/runtime SHA `f013f72722c18a6df06ad7c6390be668ed239dbf`; alignment was proven by independent build/production asset equality, not inferred from CI or a PR preview.
- [x] **C6.2** Validate 320/375/390/430/768/1024/1280/1440 where tooling permits.
  - Production retest passed People Directory/Profile/Wizard and relevant Picker surfaces. C6-DEFECT-002 horizontal overflow is FIXED; no clipped primary action/dialog remained.
- [x] **C6.3** Validate Light/Dark/System, pt-PT/en/es, keyboard/focus, loading/error/empty/retry and horizontal overflow.
  - Production plus independent exact-SHA sanitized runtime evidence passed. System dense cases were complemented by exact-SHA runtime rather than falsely claimed from DevTools emulation.
- [x] **C6.4** Validate 401/403, stale-response ownership, double submit and PWA privacy.
  - Production verified 401, authority tampering rejection, identity-only recommendation query, browser storage/cache privacy and no candidate PII leakage. Exact-SHA API/application boundary tests separately covered 403/capability/tenant/idempotency; exact-SHA runtime covered stale ownership/double-submit/retry.
- [x] **C6.5** Resolve every P0/P1 before final People acceptance.
  - Independent final disposition: C6-DEFECT-001 FIXED; C6-DEFECT-002 FIXED; `P0 OPEN: 0`, `P1 OPEN: 0`, `P2 OPEN: 0`, `P3 OPEN: 0`.

C6 final evidence:
- PR #321 responsive correction final head `93f2da162ef75e41f3535766a0a20938a4fb9379`; squash merge/product SHA `f013f72722c18a6df06ad7c6390be668ed239dbf`.
- PR #321 quality PASS + browser-regression PASS + canonical `netlify/eutakes` preview PASS.
- Main push CI `33008055369` on exact `f013f727...`: SUCCESS.
- Independent Manus final closure report: `FINAL VERDICT: ACCEPT / C6 READY TO CLOSE`; canonical production assets matched the independent detached build of exact `f013f727...`.
- Issue #319 Principal-reviewed and closed as `completed` on 2026-08-26.
- C6 accepts the integrated People core only; explicit unchecked master items remain open.

## C7 — Source-of-truth synchronization

- [x] **C7.1** Update `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` only from integrated evidence.
  - Master synchronized from accepted C1–C6 evidence; initial C7 sync commit `5641b1dea7e626297e0e25d9fd398a594b710ba1`; wording-only correction commit `e2313bf73d7e2697936708461ab8e08a5fec34b9` restored the pre-existing capability-check requirement without changing product status.
- [x] **C7.2** Record already Principal-accepted PX1 closure if still stale.
  - PX1.1–PX1.14 now checked from PR #283/#304, issue #270 and C6 evidence.
- [x] **C7.3** Record PX3/PX4 completion from current evidence.
  - PX3.1–PX3.9 checked, including authoritative PX3.4/PX3.7 from `7592fb7...`; PX4.1–PX4.12 checked from Directory integration plus C6 responsive/privacy evidence.
- [x] **C7.4** Mark only genuinely completed PX5/PX6/PX7 items; leave contract/UI gaps unchecked.
  - PX5 gaps preserved: PX5.3, PX5.4, PX5.6.
  - PX6 gaps preserved: PX6.2, PX6.3, PX6.4.
  - PX7 gap preserved: PX7.8 only.
  - PX10 was also synchronized conservatively: real screen-reader, 200%/400% zoom, full write-capable walkthrough and final reference-quality decision remain unchecked.
- [x] **C7.5** Record final main SHA and canonical production evidence.
  - **Accepted product/runtime SHA remains `f013f72722c18a6df06ad7c6390be668ed239dbf`.** Independent production alignment was proven by exact production-asset equality against a detached build of that SHA.
  - Later commits `5641b1...`, `100fab8ba643a432d4e324b10e5f195d1c51a0f0`, `e2313bf...` and this tracker synchronization are documentation-only and do not replace the accepted runtime SHA.
  - `docs/AI_HANDOFF.md` synchronized post-C6 at docs commit `100fab8ba643a432d4e324b10e5f195d1c51a0f0`.

**C7 status: COMPLETE.** The Product Experience master, AI handoff and Principal tracker now agree on what is accepted, what remains open, and which SHA is the accepted production/runtime composition.

## Branch hygiene register

| Branch / PR | State | Action |
|---|---|---|
| `main` | ACTIVE SOURCE OF TRUTH | Never rewrite/force-push |
| `principal/c6-responsive-overflow` / #321 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
| `principal/c5-7-profile-candidate-insight` / #317 | MERGED / AUTO-DELETED | Do not recreate solely for docs |
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

No Wave 1/C5/C6 implementation branch is active.

## Completion record

- `2026-08-26 — C0 tracker/hygiene — PR #310 — initial branch inventory 85 — historical quarantine established`
- `2026-08-26 — C1 PX4.11 — PR #308 — merge 457b21dab7e134c6ff3b2f0a29d15cd1fa0dc56d — CI 32953527991 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C2 PX6 foundation — PR #309 — merge 6673cfcc14e89f5666a72941b3f44246a71ff5db — CI 32956000440 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C3 PX7 backend/domain foundation — PR #307 — merge 58964b7c0080dd89b92459241de71ccdda111f6c — CI 32957109650 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C4 PX5 profile foundation — PR #305 — merge 891369306414003dbea49371a02cff6c02c1c324 — CI 32958989117 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C5.1 Directory -> Profile — PR #311 — merge fcdf51f7317d893721dff79c3f4fc17f3e4a850d — CI 32960668620 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C5.2 Directory Add/Edit -> PersonWizard — PR #312 — merge 495d21cc970ee2d5379d88fe2d99882a5e5ffe66 — CI 32962712469 PASS/PASS — canonical preview PASS`
- `2026-08-26 — C5.3 authenticated PX7 adapter — PR #313 — merge 0c1fdb45c1bfbb4f4a26b9c671df845c9d592a6c — CI 32966364434 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.4 PX7 reason localization — PR #314 — merge a9710362a672664d754ad615967038b08d98be6a — CI 32967568203 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.5 recommendation picker — PR #315 — merge 46665eab2218f4b806497b281732d4f8b56c69ec — CI 32970183672 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.6 all-eligible escape hatch — PR #316 — merge 79407fd54230dc9f9b05edadc3cd767575d592b2 — CI 32971748866 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.7 profile contextual PX7 insight — PR #317 — merge 57f509e870c240e0d187d7eadd4aa1efbf93423b — CI 32974585573 PASS/PASS — canonical preview PASS — branch auto-deleted`
- `2026-08-26 — C5.8 integrated People gates — main product SHA 57f509e870c240e0d187d7eadd4aa1efbf93423b — main CI 32974975422 PASS/PASS — canonical final-slice preview PASS`
- `2026-08-26 — C6-DEFECT-001 production recommendation route — main 401c64675a6e299299d796d48989d63474f9ddd0 — independent production retest FIXED`
- `2026-08-26 — C6-DEFECT-002 responsive overflow — PR #321 — final head 93f2da162ef75e41f3535766a0a20938a4fb9379 — squash merge f013f72722c18a6df06ad7c6390be668ed239dbf — quality/browser PASS — canonical preview PASS — independent production retest FIXED — branch auto-deleted`
- `2026-08-26 — C6 independent acceptance — accepted product/runtime SHA f013f72722c18a6df06ad7c6390be668ed239dbf — issue #319 CLOSED/ACCEPT — C6.2/C6.3/C6.4/C6.5 PASS — P0/P1/P2/P3 OPEN 0`
- `2026-08-26 — C7 source-of-truth synchronization — master docs commits 5641b1dea7e626297e0e25d9fd398a594b710ba1 + e2313bf73d7e2697936708461ab8e08a5fec34b9 — AI_HANDOFF 100fab8ba643a432d4e324b10e5f195d1c51a0f0 — PX1/PX3/PX4 synchronized; PX5/PX6/PX7/PX10 gaps preserved`
