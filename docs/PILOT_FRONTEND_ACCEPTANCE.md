# Eutaktos — frontend pilot acceptance

Date: 2026-08-24

Canonical production: `https://eutakes.netlify.app/`

Integrated base before this frontend acceptance pass: `3d0880a5dd6f350a373de36bd47777835e0fa6fe`

Frontend acceptance candidate code SHA: `9793dc8b4e1435a8f12d17723b0a9132ebc6b35b`

Frontend queue: #235 (`MP1`–`MP8`)

## Verdict

**PASS for the repository/frontend scope required by MP8.**

The frontend gate is intentionally separate from AP6/AP8 production acceptance. Real three-mailbox role login and physical iPhone/Android smoke evidence remain principal acceptance dependencies and are not converted into frontend PASS evidence here.

## MP1–MP8 matrix

| Task | Result | Acceptance evidence |
| --- | --- | --- |
| MP1 — Recovery states on real API screens | **PASS after principal correction** | The original Manus MP1 PR remains rejected because its hooks were not wired into production. Principal review instead inspected the real screens. People, Households, Service Groups, Responsibilities, Access, Audit and Midweek Agenda/Assignments have real loading/empty/error/retry states, abort ownership and write pending/double-submit guards where applicable. Home had one remaining gap: degraded production data required a full page refresh. This acceptance pass adds an explicit retry, aborts a superseded request and ignores stale/aborted responses. Preferences is local-only and therefore has no API loading/retry state. |
| MP2 — Forms/dialog accessibility | **PASS** | Accepted production ARIA/focus/keyboard changes plus the accessibility/browser gates remain green. Destructive and discard confirmations retain pending/disabled behavior. |
| MP3 — Responsive matrix | **PASS** | Real Chromium rendered-layout gate covers 320, 375, 390, 430, 768, 1024, 1280 and 1440 px. It fails on horizontal overflow or clipped interactive content. |
| MP4 — i18n/date/time | **PASS** | pt-PT, en and es are exercised across real routes; civil-date regressions are covered. Domain/application DST and Lisbon local-time validation are now integrated through KP5/KP8. |
| MP5 — PWA install/update/offline | **PASS** | Update lifecycle, safe refresh, offline notice and service-worker privacy behavior are covered by accepted unit/runtime gates. API/auth responses are not treated as offline operational data. |
| MP6 — Browser privacy/security | **PASS** | The real PWA privacy gate limits browser persistence to approved preferences and rejects API/auth/private caching. No session/access token persistence is accepted. |
| MP7 — Deep-link/navigation + visual regression | **PASS** | Production-mount, UX runtime and sanitized visual gates exercise direct routes, unknown-route fallback, localized titles, focus restoration and rendered layouts across locales/viewports. |
| MP8 — Frontend pilot acceptance | **PASS** | MP1–MP7 are accepted on the integrated base plus the Home recovery correction in this branch. The root PR CI must remain green for quality and browser-regression before merge. |

## MP1 principal real-screen review

### Home

`ProductionDashboard` reads People, Responsibilities and Midweek data. The acceptance correction adds an owned retry button for degraded state, aborts any superseded request and uses a monotonically increasing request version so a late response from an older request cannot overwrite the retry result. Unmount also invalidates the request and aborts its controller.

### People

The production `PeopleDirectory` uses loading, empty/no-result, retryable read error, `AbortController`, write failure messages and a synchronous ref in addition to disabled/pending state to prevent double create/update submission. Success is rendered only after the API write resolves.

### Households / Service Groups / Responsibilities

The real sections each use abortable initial reads, loading/empty/retryable error states, operation-specific error states, explicit pending UI and ref-based duplicate-write guards. Destructive writes require confirmation and do not show success until the API resolves.

### Access / Audit

Access management has separate directory/grant loading ownership, retryable read failure, grant/revoke confirmation, pending guards and no inferred capability success. Audit history uses abortable reads, explicit loading/empty/error/retry and disables refresh/close while the owned load is in progress.

### Agenda / Assignments

`MidweekWorkspace` uses request-version ownership plus `AbortController`, preventing an older overview response from overwriting a newer one. Loading, empty and retryable failure states are real. Authoring controls are exposed only after the authenticated session reports `schedule.write`; person-dependent controls remain unavailable if their supporting directory read fails.

### Preferences

Preferences is not an API screen. It is normalized from local preferences and persisted under the approved preference storage key. API/session data is not persisted there. The PWA privacy gate is authoritative for this boundary.

### 401 / 403 behavior

Authentication is fail-closed in `AuthBoundary`: protected application content is released only after an authenticated session is resolved (including restored-session rotation). Server/transport tests cover unauthorized/forbidden boundaries; API failures remain failures in the real screens and are not transformed into optimistic success. Capability decisions remain server-derived.

## Combined browser gate

The browser regression command executes:

```bash
npm run test:browser-regression --workspace @eutaktos/web-pwa
```

It includes:

- web typecheck;
- web unit tests;
- bundle budget;
- PWA privacy;
- production mount/deep-link asset resolution;
- Chromium UX runtime;
- sanitized rendered-layout matrix;
- Hourglass inspector runtime.

Required rendered viewport matrix:

- 320 px;
- 375 px;
- 390 px;
- 430 px;
- 768 px;
- 1024 px;
- 1280 px;
- 1440 px.

Locales exercised by the browser gates: `pt-PT`, `en`, `es`.

No production screenshots or production data are retained by the sanitized visual gate.

## P0/P1 review

At this acceptance pass, repository issue searches found no open issue explicitly titled or labelled P0/P1. This is evidence about the tracked repository state, not a substitute for the final authenticated production/device run in AP8.

## Remaining dependencies outside MP8

These do **not** reopen the frontend queue:

1. final authenticated production E2E against `https://eutakes.netlify.app/` after this frontend acceptance merge;
2. three real email identities proving admin / limited operator / ordinary-user behavior end-to-end;
3. real iPhone smoke evidence;
4. real Android smoke evidence;
5. final AP8 verdict at the integrated production SHA.

Those remain in principal queue #237. Until they are completed, the product-level pilot verdict remains **BLOCKED**, even though the repository/frontend MP8 gate is PASS.
