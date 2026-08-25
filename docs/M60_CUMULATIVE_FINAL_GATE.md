# M60 — Cumulative recovery gate

> **HISTORICAL RECOVERY EVIDENCE — NOT CURRENT DEPLOYMENT OR BACKLOG TRUTH.**
>
> This document records the recovery state that existed on 2026-08-23. Its references to the Rainbow Netlify project are historical and are **not** the current production target. Current canonical production is `https://eutakes.netlify.app/`, and current product priorities/status are controlled by `docs/AI_HANDOFF.md` and `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`.

## Baseline

| Field | Value |
|---|---|
| Main baseline | `15da4af92faef8cd766ebcf610542e8d1464f38e` |
| Historical production target used by this recovery run | `https://rainbow-zuccutto-00d981.netlify.app/` |
| Recovery date | 2026-08-23 Europe/Lisbon |
| Scope | Consolidated frontend/PWA/source gates plus unauthenticated production runtime smoke |

This document superseded the previous M50/M53/M54/M60 evidence **for that historical recovery run only**. It does not supersede the current Product Experience source of truth.

## Consolidated changes

The following recovery lot was on `main` at that time:

- PR #191 — stale Midweek overview responses cannot overwrite a newer retry;
- PR #192 — audit dialog description/loading accessibility hardening;
- PR #195 — localized, honest offline PWA status;
- PR #196 — initial bundle budget tightened to 480,000 bytes;
- PR #197 — browser/PWA privacy guard extended to Cache Storage access and offline `no-store`;
- PR #198 — expanded canonical/deep-link navigation matrix;
- PR #199 — sanitized rendered-layout regression at 320/390/1440 px, corrected during review and included in the permanent browser regression gate.

PRs #190, #193, #194 and #200 were closed without merge because their evidence was obsolete, non-cumulative or tied to the wrong production deployment for that recovery pass.

## Source and browser gates

PR #199 was not merged until the corrected cumulative gate passed:

| Gate | Status |
|---|---|
| Root/PWA typecheck | PASS |
| PWA unit tests | PASS — 28 files / 123 tests in the final reviewed run |
| Production build | PASS |
| Initial bundle budget | PASS — 476,563 bytes, below 480,000 bytes |
| PWA privacy | PASS |
| Production mount | PASS |
| UX runtime | PASS on the successful final attempt |
| Sanitized visual regression | PASS and now part of `test:browser-regression` |
| Hourglass inspector | PASS through the cumulative browser gate |

During review, an intermittent Chromium test-harness `DOMStorage` frame error was observed in the pre-existing UX runtime gate. A rerun on the same code passed the full browser suite. It is recorded as test-infrastructure flakiness, not converted into a product PASS/FAIL claim.

## Historical Rainbow production smoke

A disposable, non-merged PR #202 ran a GitHub Actions job directly against the Rainbow host. Workflow run `32604915171` completed successfully.

Observed responses at that historical point:

| Request | Result |
|---|---|
| `GET /` | `200 text/html`; Eutaktos shell present |
| `GET /pessoas` | `200 text/html`; SPA deep-link fallback present |
| `GET /api/health` | `200 application/json` — `{"status":"ok","service":"eutaktos-api"}` |
| `GET /api/ready` | `200 application/json` — `{"status":"ready","database":"reachable"}` |

The smoke test proved public shell/deep-link/API health/readiness for that host at the time of the run. It does not assert the current production target or current deployed Git SHA.

## Acceptance matrix

| Area | Status | Reason |
|---|---|---|
| Source/typecheck/unit/build | PASS | Consolidated CI evidence |
| Browser/PWA regression | PASS | Full gate including M59 passed before merge |
| Responsive automated baseline | PASS | 320/390/1440 rendered-layout gate plus existing UX reflow checks |
| Navigation/deep links | PASS | Source/browser tests and historical Rainbow `/pessoas` smoke |
| PWA privacy/cache guards | PASS | Repeatable source/build gate |
| Historical Rainbow public shell | PASS | Direct historical production smoke |
| Historical Rainbow API health | PASS | Direct historical production smoke |
| Historical Rainbow database readiness | PASS | Direct historical production smoke reports `database: reachable` |
| Authenticated pilot session | NOT TESTED | No authorized pilot credential/session was used in this recovery gate |
| People/Organization real CRUD in production | NOT TESTED | Requires authorized pilot session and disposable pilot records |
| Access/Audit real mutations in production | NOT TESTED | Requires authorized pilot session |
| Midweek create/assign/replace/publish/refresh E2E | NOT TESTED | Requires authorized pilot session and disposable pilot data |
| Cross-tenant production isolation | NOT TESTED | Requires two explicitly authorized test tenants |
| External notification provider delivery | NOT TESTED | Requires configured real provider; pending intent is not delivery |
| Physical iOS/Android install/keyboard/rotation | NOT TESTED | No physical-device run in this recovery gate |

## Historical verdict

**Recovery consolidation was accepted for source, automated browser/PWA gates and unauthenticated runtime readiness in the environment used by this 2026-08-23 recovery run.**

Do not use this verdict as current Product Experience acceptance. Current work follows the People-first master plan and canonical `eutakes.netlify.app` production target.
