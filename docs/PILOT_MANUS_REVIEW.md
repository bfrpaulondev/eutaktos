# Eutaktos — principal review of Manus pilot queue

Date: 2026-08-24

Final frontend acceptance base: `3d0880a5dd6f350a373de36bd47777835e0fa6fe`

This record distinguishes work delivered by Manus from work actually accepted after principal review. A Manus PR is not treated as release evidence merely because it exists or its isolated CI passed.

| Task | Review result | Integration evidence |
| --- | --- | --- |
| MP1 — recovery states | **PASS after principal review/correction** | Manus PR #252 remains rejected: its hooks were not wired into real MVP screens and its duplicate-submit behavior was unsafe. Principal review inspected the actual production screens instead. People, Households, Service Groups, Responsibilities, Access, Audit and Midweek Agenda/Assignments already had real loading/empty/error/retry ownership and pending/double-submit guards where applicable. The remaining Home gap was corrected in PR #265: `ProductionDashboard` now has an owned retry, aborts superseded requests and ignores stale/aborted responses. Preferences is local-only and therefore has no API recovery state. |
| MP2 — accessibility | **PASS** | PR #249 was corrected so tests inspect the real production component behavior instead of mock dialogs/no-op assertions. ARIA labelling changes passed full CI and were merged. |
| MP3 — responsive matrix | **PASS** | PR #248's copied-CSS pseudo-tests were removed. The real Chromium sanitized visual gate renders 320/375/390/430/768/1024/1280/1440 widths across pt-PT/en/es and checks overflow/clipped interactive content. |
| MP4 — i18n/date-time | **PASS** | PR #254 adds real date-only civil-date/locale regression coverage. Domain timezone/DST validation is now integrated through KP5/KP8. |
| MP5 — PWA update/offline | **PASS** | PR #253 adds real controller lifecycle tests for waiting workers, `SKIP_WAITING`, one-time reload, disposal and update checks. Existing PWA privacy/service-worker gates remain authoritative. |
| MP6 — browser privacy | **PASS via existing real gate; Manus PR rejected** | PR #255 was closed without merge because most tests asserted constants/comments or used no-op assertions. `npm run test:pwa-privacy --workspace @eutaktos/web-pwa` scans actual production source/storage access and service-worker cache rules and is part of browser regression. |
| MP7 — navigation/deep links | **PASS** | PR #250 was corrected to remove a no-op auth/deep-link assertion and now tests the real navigation helpers. Production-mount/UX-runtime/visual gates provide rendered deep-link evidence. |
| MP8 — final frontend acceptance | **PASS** | Principal PR #265 regenerates the final acceptance record after KP1-KP8 integration, includes the MP1 Home correction, and passed full quality + browser-regression. Canonical report: `docs/PILOT_FRONTEND_ACCEPTANCE.md`. |

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

The final MP8 candidate passed both the repository quality job and browser-regression before integration.

## Frontend queue closure

The frontend/PWA repository scope MP1–MP8 is complete. No tracked open repository issue was found explicitly titled or labelled P0/P1 at final review time.

The following are **not frontend queue defects** and remain in principal production acceptance #237:

- final authenticated production E2E after the MP8 merge;
- three real email identities for admin / limited operator / ordinary-user behavior;
- real iPhone smoke evidence;
- real Android smoke evidence;
- final AP8 verdict at the integrated production SHA.
