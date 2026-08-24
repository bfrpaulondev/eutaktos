# Eutaktos — principal review of Manus pilot queue

Date: 2026-08-24

Reviewed base after accepted integrations: `40ec8fe6b578d78297f6caa9f189d5b14d573463`

This record distinguishes work delivered by Manus from work actually accepted after principal review. A Manus PR is not treated as release evidence merely because it exists or its isolated CI passed.

| Task | Review result | Integration evidence |
| --- | --- | --- |
| MP1 — recovery states | **NOT ACCEPTED AS DELIVERED** | PR #252 was closed without merge. Its new hooks were not wired into the real MVP screens and `useApiWrite` returned a never-resolving Promise on a duplicate submit. Existing production screens retain their real loading/error/retry/AbortController/pending/double-submit guards. Final integrated acceptance will exercise the actual screens rather than unused hooks. |
| MP2 — accessibility | **PASS** | PR #249 was corrected so tests inspect the real production component source instead of mock dialogs/no-op assertions. ARIA labelling changes passed full CI and were merged. |
| MP3 — responsive matrix | **PASS** | PR #248's copied-CSS pseudo-tests were removed. The real Chromium sanitized visual gate now renders the required 320/375/390/430/768/1024/1280/1440 widths across pt-PT/en/es and checks overflow/clipped interactive content. Full CI passed and the PR was merged. |
| MP4 — i18n/date-time | **PASS for delivered scope** | PR #254 adds real date-only civil-date/locale regression coverage and was merged after green CI. Domain timezone/DST validation remains owned by the Qwen/application workstream. |
| MP5 — PWA update/offline | **PASS** | PR #253 adds real controller lifecycle tests for waiting workers, `SKIP_WAITING`, one-time reload, disposal and update checks. Existing PWA privacy/service-worker gates remain authoritative. Merged after green CI. |
| MP6 — browser privacy | **PASS via existing real gate; Manus PR rejected** | PR #255 was closed without merge because most tests asserted constants/comments or used no-op assertions. `npm run test:pwa-privacy --workspace @eutaktos/web-pwa` already scans actual production source/storage access and service-worker cache rules and is part of browser regression. |
| MP7 — navigation/deep links | **PASS** | PR #250 was corrected to remove a no-op auth/deep-link assertion and now tests the real navigation helpers. The existing production-mount/UX-runtime/visual gates provide rendered deep-link evidence. Full CI passed and the PR was merged. |
| MP8 — final frontend acceptance | **DEFERRED** | PR #251 was closed without merge because its report contained already-fixed runtime blockers. The final acceptance document must be regenerated from the integrated main after accepted Qwen KP work lands and all browser/runtime gates are rerun. |

## Combined frontend gates

The repository browser regression command runs the real integrated checks for:

- web typecheck;
- web unit tests;
- bundle budget;
- PWA privacy;
- production mount/deep-link asset resolution;
- Chromium UX runtime;
- sanitized rendered-layout matrix;
- Hourglass inspector safety.

The CI on this review branch is the combined post-integration check for the accepted Manus work. A final MP8/AP8 verdict is deliberately not issued here because Qwen KP2–KP8 and final production/device acceptance are still pending.

## Remaining frontend acceptance items

- regenerate final `PILOT_FRONTEND_ACCEPTANCE.md` only from the integrated main after Qwen work accepted by the principal agent;
- final authenticated production E2E across MVP surfaces;
- physical iPhone and Android smoke/accessibility evidence;
- prove zero unresolved MVP frontend P0/P1 at the final integrated SHA.
