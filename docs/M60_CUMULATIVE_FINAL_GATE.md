# M60 — Cumulative recovery gate

## Baseline

| Field | Value |
|---|---|
| Main baseline | `15da4af92faef8cd766ebcf610542e8d1464f38e` |
| Canonical production | `https://rainbow-zuccutto-00d981.netlify.app/` |
| Recovery date | 2026-08-23 Europe/Lisbon |
| Scope | Consolidated frontend/PWA/source gates plus unauthenticated production runtime smoke |

This document supersedes the previous M50/M53/M54/M60 evidence that used `eutakes.netlify.app` or was produced before M55–M59 were integrated.

## Consolidated changes

The following recovery lot is now on `main`:

- PR #191 — stale Midweek overview responses cannot overwrite a newer retry;
- PR #192 — audit dialog description/loading accessibility hardening;
- PR #195 — localized, honest offline PWA status;
- PR #196 — initial bundle budget tightened to 480,000 bytes;
- PR #197 — browser/PWA privacy guard extended to Cache Storage access and offline `no-store`;
- PR #198 — expanded canonical/deep-link navigation matrix;
- PR #199 — sanitized rendered-layout regression at 320/390/1440 px, corrected during review and included in the permanent browser regression gate.

PRs #190, #193, #194 and #200 were closed without merge because their evidence was obsolete, non-cumulative or tied to the wrong production deployment.

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

## Canonical Rainbow production smoke

A disposable, non-merged PR #202 ran a GitHub Actions job directly against the canonical production host. Workflow run `32604915171` completed successfully.

Observed responses:

| Request | Result |
|---|---|
| `GET /` | `200 text/html`; Eutaktos shell present |
| `GET /pessoas` | `200 text/html`; SPA deep-link fallback present |
| `GET /api/health` | `200 application/json` — `{"status":"ok","service":"eutaktos-api"}` |
| `GET /api/ready` | `200 application/json` — `{"status":"ready","database":"reachable"}` |

Therefore the earlier `503 database: unconfigured` finding does **not** apply to the canonical Rainbow production deployment. That result came from the wrong Netlify project.

The smoke test proves public shell/deep-link/API health/readiness at the time of the run. It does not assert the exact deployed Git SHA because the production API currently exposes no release-SHA endpoint.

## Acceptance matrix

| Area | Status | Reason |
|---|---|---|
| Source/typecheck/unit/build | PASS | Consolidated CI evidence |
| Browser/PWA regression | PASS | Full gate including M59 passed before merge |
| Responsive automated baseline | PASS | 320/390/1440 rendered-layout gate plus existing UX reflow checks |
| Navigation/deep links | PASS | Source/browser tests and real Rainbow `/pessoas` smoke |
| PWA privacy/cache guards | PASS | Repeatable source/build gate |
| Rainbow public shell | PASS | Direct production smoke |
| Rainbow API health | PASS | Direct production smoke |
| Rainbow database readiness | PASS | Direct production smoke reports `database: reachable` |
| Authenticated pilot session | NOT TESTED | No authorized pilot credential/session was used in this recovery gate |
| People/Organization real CRUD in production | NOT TESTED | Requires authorized pilot session and disposable pilot records |
| Access/Audit real mutations in production | NOT TESTED | Requires authorized pilot session |
| Midweek create/assign/replace/publish/refresh E2E | NOT TESTED | Requires authorized pilot session and disposable pilot data |
| Cross-tenant production isolation | NOT TESTED | Requires two explicitly authorized test tenants |
| External notification provider delivery | NOT TESTED | Requires configured real provider; pending intent is not delivery |
| Physical iOS/Android install/keyboard/rotation | NOT TESTED | No physical-device run in this recovery gate |

## Verdict

**Recovery consolidation is accepted for source, automated browser/PWA gates and unauthenticated canonical production runtime readiness.**

The project is no longer blocked by an unconfigured production database on the canonical Rainbow deployment. The next acceptance boundary is authenticated pilot E2E, not more frontend evidence documents.

A task is considered DONE only after review, integration to `main`, Rainbow deployment and the relevant production validation have all succeeded.
