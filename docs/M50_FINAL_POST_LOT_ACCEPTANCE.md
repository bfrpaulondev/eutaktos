# M50 — Final Post-Lot Acceptance

## Baseline and environment

| Field | Value |
|---|---|
| Audited main | `7817833584e3b3b469b1564cf4f9231471b04be1` |
| Production URL | `https://eutakes.netlify.app/` |
| Audit date | 2026-08-22 GMT+1 |
| Scope | Frontend/PWA validation only; no domain, application, runtime, Supabase, hosting, secret or data mutation. |

## Automated gates

| Command | Status | Result |
|---|---|---|
| `npm run typecheck` | PASS | Typecheck passed. |
| `npm test` | PASS | Root suite and adversarial regression passed; PWA unit suite: 28 files, 122 tests. |
| `npm run build --workspace @eutaktos/web-pwa` | PASS | Production build passed. |
| `npm run test:bundle-budget --workspace @eutaktos/web-pwa` | PASS | Initial chunk 475,700 bytes; lazy workspace chunk 186,249 bytes. |
| `npm run test:pwa-privacy --workspace @eutaktos/web-pwa` | PASS | Preferences-only storage and static-cache exclusions for API/auth/query/private responses verified. |
| `npm run test:production-mount --workspace @eutaktos/web-pwa` | PASS | Manifest, icons and service-worker safeguards verified. |
| `npm run test:ux-runtime --workspace @eutaktos/web-pwa` | PASS | pt-PT/en/es, deep links, More focus restore, 320px reflow, skip link, landmarks, `aria-current`, dark/high contrast. |
| `npm run test:hourglass-inspector --workspace @eutaktos/web-pwa` | PASS | Sanitised fixture, safe parse/size errors, contact-list limitation, local-only handling and close control. |
| `npm run test:browser-regression --workspace @eutaktos/web-pwa` | PASS | Repeated integrated browser suite passed. |

## Production runtime observations

| Scenario | Status | Environment | Reproduction | Observed result |
|---|---|---|---|---|
| Production shell | PASS | Netlify public URL | `GET /` | HTTP 200 HTML PWA shell. |
| Health | PASS | Netlify public URL | `GET /api/health` | HTTP 200 JSON: `{"status":"ok","service":"eutaktos-api"}`; `no-store`, `no-referrer` and `nosniff` headers observed. |
| Readiness | BLOCKED | Netlify public URL | `GET /api/ready` | HTTP 503 JSON: `{"status":"not-ready","database":"unconfigured"}`. This is environment/runtime configuration, not patched in this frontend-only task. |
| Login/session boundary | NOT TESTED | Netlify public URL | Requires an authorised pilot session. | No session token was requested, inspected or committed. |
| People, organization, access/audit real CRUD | BLOCKED | Netlify public URL | Requires ready database and authorised pilot tenant. | Not attempted while readiness is 503. |
| Midweek API reads/writes and assignment lifecycle | BLOCKED | Netlify public URL | Requires ready database plus safe pilot data. | Not attempted; no mock or fake success used. |
| Tenant isolation E2E | BLOCKED | Netlify public URL | Requires two authorised test tenants and ready runtime. | No unrelated tenant access attempted. |
| Notification provider delivery | BLOCKED | Netlify public URL | Requires configured provider and observed provider response. | Pending intent is not treated as delivery. |

## UX, accessibility, i18n and PWA

| Scenario | Status | Evidence |
|---|---|---|
| pt-PT, English and Español shell/workspaces/dialogs | PASS | UX runtime gate passed. |
| Deep links, aliases, titles, unknown fallback, back/forward and More focus | PASS | UX runtime gate passed. |
| Keyboard baseline | PASS | Skip link, `main`, navigation, active route and visible focus assertions passed. |
| 320px automated reflow | PASS | UX runtime gate passed. |
| 375/390/768/1024/1440 visual matrix | PASS | Existing M35 evidence retained; no product data used. |
| Android/iOS, VoiceOver/TalkBack, physical install and virtual keyboard | NOT TESTED | Physical-device evidence unavailable. |
| API/auth cache and sensitive browser storage | PASS | Privacy gate passed. |
| Hourglass privacy and implicit import | PASS | Inspector gate uses only committed sanitised fixture and asserts local-only preview. |

## Counts

| Status | Count |
|---|---:|
| PASS | 16 |
| FAIL | 0 |
| BLOCKED | 6 |
| NOT TESTED | 2 |

## Frontend defects fixed in M50

None. All frontend/PWA automated gates required by the issue passed on the audited main. No source correction was justified by evidence in this branch.

## External blockers

The Netlify readiness endpoint is correctly reachable but reports database configuration absent (`503`). This prevents safe validation of authenticated pilot sessions, real data CRUD, scheduling persistence, tenant isolation and provider-backed notification delivery. Those items remain **BLOCKED**, never PASS.

## Conclusion

**Frontend/PWA acceptance: PASS, conditional on the documented external readiness blocker.** There are no unresolved frontend-only FAILs in this audit. Runtime-backed product acceptance remains blocked until Netlify reports readiness and a safe authorised pilot environment is available.
