# Eutaktos — principal pilot finalization

Date: 2026-08-24

Canonical production: `https://eutakes.netlify.app/`

Initial base for this finalization pass: `f30ef774da8dcc4ab04313ec956ba8594022c803`

Principal queue: #237 (`AP1`–`AP8`)

This document records the work that is exclusively owned by the principal/runtime workstream and separates it from evidence that still depends on Manus/Grok integration, additional mailboxes or physical devices.

## Principal-owned status

| Task | Principal-owned status | Evidence / remaining dependency |
| --- | --- | --- |
| AP1 — Production readiness | **PASS** | `/api/health` and `/api/ready` were previously proven factual against canonical production. A repeatable manual preflight now lives at `npm run pilot:preflight`; it is intentionally not part of normal CI because external Netlify/network availability must not make repository CI flaky. |
| AP2 — Authentication edge cases | **PASS** | Scanner-safe Magic Link works. Permanent server tests cover idle expiry, absolute expiry, revocation, malformed expiry, secure cookie behavior and server-derived capabilities. Supabase Auth logs directly show successful OTP login, repeated OTP requests, provider rate limiting and used/expired one-time tokens returning 403 without logging the token value. Restored authenticated browser sessions now rotate before protected UI renders; rotation failure fails closed and an aborted owning check does not start a late rotation. Temporary pilot codes are disabled by default. |
| AP3 — Availability/eligibility/scheduling runtime | **PASS** | Production DB disposable-tenant drill already proved away period, explicit eligibility, Midweek persistence, stale-write rejection and zero residue after cleanup. |
| AP4 — Multi-user role matrix | **PASS for server/runtime scope** | Production DB disposable role drill already proved admin/limited/ordinary grants and fail-closed identity binding. `api/pilot-role-matrix.test.ts` makes the server principal matrix permanent and explicitly proves forged browser tenant/actor/capability fields are ignored and same actor IDs remain tenant-scoped. Real three-mailbox login remains an external acceptance item. |
| AP5 — Backup/export/restore | **PASS** | Real production DB export → mutation → restore → re-export round trip already passed with stable IDs/relations and cleanup. Pilot RPO/RTO targets are recorded in `docs/PILOT_PRINCIPAL_ACCEPTANCE.md`. |
| AP6 — Production E2E | **READY, waiting on integrated main** | Principal/runtime preflight is repeatable. The final authenticated cross-module E2E must be rerun after accepted Manus/Grok work lands. No session credential is committed or embedded in automation. |
| AP7 — Pilot tenant/runtime configuration | **PASS** | Pilot timezone is `Europe/Lisbon`; temporary pilot codes are absent/disabled; known technical fixtures were cleaned; canonical built-in Midweek definitions remain intentionally seeded. Supabase project is healthy. |
| AP8 — Pilot acceptance | **READY, externally blocked** | Principal-owned gates are prepared. Final verdict must wait for accepted Manus/Grok work, three real pilot identities through email login and desktop + real iPhone + real Android smoke evidence. |

## Fresh acceptance evidence from this finalization pass

### Supabase project health

- Eutaktos project status: `ACTIVE_HEALTHY`.
- Region: `eu-west-1`.
- Performance advisor: no findings.
- Security advisor: Eutaktos tables report `RLS enabled, no policy` as informational; this matches the current server-only direct-table-access boundary documented in `PILOT_PRINCIPAL_ACCEPTANCE.md`.
- Security advisor also reports leaked-password protection disabled. The pilot is passwordless email; if password auth is added later this must be revisited.

### Current production data hygiene

At the time of this pass:

- active temporary pilot access codes: `0`;
- active non-revoked/unexpired Eutaktos sessions: `0`;
- authorized identities: `1`;
- active capability grants: `13`.

No new probe tenant or test identity was left behind by this finalization pass.

### Authentication evidence

Recent Supabase Auth logs show:

- successful passwordless email OTP verification/login;
- used/expired one-time tokens fail with `403` / `otp_expired`;
- repeated email requests are rate-limited by the provider when the configured threshold is exceeded;
- Auth log events contain request metadata and account identifiers, but not the one-time token value/token hash.

The scanner-safe Eutaktos flow therefore has evidence for both success and failure paths. Restored active Eutaktos sessions also rotate through `/api/session/rotate` before `AuthBoundary` releases protected application content. The frontend gate fails closed if rotation fails and preserves the already-fresh Magic Link path without an unnecessary second rotation.

## Repeatable production preflight

Run manually from a trusted network:

```bash
npm run pilot:preflight
```

Optional overrides:

```bash
EUTAKTOS_PILOT_BASE_URL=https://eutakes.netlify.app \
EUTAKTOS_PILOT_PREFLIGHT_TIMEOUT_MS=15000 \
EUTAKTOS_PILOT_PREFLIGHT_NETWORK_ATTEMPTS=3 \
npm run pilot:preflight
```

The preflight retries **network exceptions only**. A wrong HTTP status, wrong content type or wrong response body remains a hard failure.

The preflight checks, without using credentials:

- `/` production shell;
- `/pessoas` direct deep link;
- scanner-safe `/auth/confirm` deep link with a dummy non-secret hash;
- absolute `/assets/...` references and no `/auth/assets/...` regression;
- `/api/health` factual 200 contract;
- `/api/ready` factual database-reachable 200 contract;
- People, Midweek, Audit and Access protected reads fail closed with 401 when no session is supplied.

This script is intentionally **manual-only** and is not invoked by the default `npm test` gate.

## Permanent server role matrix

`api/pilot-role-matrix.test.ts` covers three sanitized server-side pilot profiles:

- administrator: people/schedule write + audit/access/tenant administration;
- limited operator: people read + schedule read/write, no access/audit/tenant administration;
- ordinary user: read-only pilot surfaces.

The gate also proves:

- forged `x-tenant-id`, `x-actor-id`, `x-capabilities` and equivalent query values do not affect the verified principal;
- capabilities come only from server-side active grants;
- identical actor IDs in different tenants do not inherit each other's grants.

## Principal finalization commits

- `a2c659a248532a8275ded6e23343da6b0a54f64f` — permanent role matrix, manual production preflight and principal finalization record; quality + browser-regression PASS.
- `5ed7244f54a0795b37a4f133f1b863b21b324895` — network-exception resilience and per-step logging for the manual preflight; quality + browser-regression PASS.
- `3f9d6a39c4654257b50f9540d523c84099fa283b` — restored-session rotation before protected UI activation, including abort-safe ownership check; quality + browser-regression PASS.

## What remains before AP8 can become PASS

These are not unimplemented principal-runtime tasks:

1. accepted Manus MP1–MP8 changes integrated into one current `main`;
2. accepted Grok KP1–KP8 changes integrated into the same `main`;
3. one final authenticated production E2E across the MVP after those merges;
4. three real email identities demonstrating admin / limited / ordinary behavior end-to-end;
5. desktop + real iPhone + real Android smoke evidence;
6. zero unresolved MVP P0/P1 after the integrated run.

Until those conditions are available, the correct AP8 status is **BLOCKED**, not a false PASS.
