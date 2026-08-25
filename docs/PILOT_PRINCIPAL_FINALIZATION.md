# Eutaktos — principal pilot finalization

> **HISTORICAL PILOT FINALIZATION — NOT CURRENT PRODUCT-EXPERIENCE COMPLETION.**
>
> This document records the pre-Product-Experience pilot state. Current priorities, canonical active backlog and UI/UX completion are defined by `docs/AI_HANDOFF.md` and `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`. Statements such as “repository integration is complete” below apply only to that historical pilot scope.

Date: 2026-08-24

Canonical production: `https://eutakes.netlify.app/`

Current integrated acceptance base after KP1–KP8 and MP1–MP8: `868c2eb96f13e17678c00851ba5de6fabdca6594`

Principal queue: #237 (`AP1`–`AP8`)

This document records the work owned by the principal/runtime workstream and separates repository-complete evidence from the remaining production acceptance that requires real identities or physical devices.

## Principal-owned status

| Task | Principal-owned status | Evidence / remaining dependency |
| --- | --- | --- |
| AP1 — Production readiness | **PASS** | `/api/health` and `/api/ready` were previously proven factual against canonical production. A repeatable manual preflight lives at `npm run pilot:preflight`; it is intentionally not part of normal CI because external Netlify/network availability must not make repository CI flaky. |
| AP2 — Authentication edge cases | **PASS** | Scanner-safe Magic Link works. Permanent server tests cover idle expiry, absolute expiry, revocation, malformed expiry, secure cookie behavior and server-derived capabilities. Supabase Auth logs directly show successful OTP login, repeated OTP requests, provider rate limiting and used/expired one-time tokens returning 403 without logging the token value. Restored authenticated browser sessions rotate before protected UI renders; rotation failure fails closed. Temporary pilot codes are disabled by default. |
| AP3 — Availability/eligibility/scheduling runtime | **PASS** | Production DB disposable-tenant drill proved away period, explicit eligibility, Midweek persistence, stale-write rejection and zero residue after cleanup. KP1–KP8 are now integrated in the same main. |
| AP4 — Multi-user role matrix | **PASS for server/runtime scope** | Production DB disposable role drill and `api/pilot-role-matrix.test.ts` prove admin/limited/ordinary grants, fail-closed identity binding and rejection of forged browser tenant/actor/capability fields. Real three-mailbox login remains an external acceptance item. |
| AP5 — Backup/export/restore | **PASS** | Real production DB export → mutation → restore → re-export round trip passed with stable IDs/relations and cleanup. Pilot RPO/RTO targets are recorded in `docs/PILOT_PRINCIPAL_ACCEPTANCE.md`. |
| AP6 — Production E2E | **READY on integrated main** | KP1–KP8 and MP1–MP8 are now integrated. The remaining AP6 work is one final authenticated cross-module E2E against canonical production. No session credential is committed or embedded in automation. |
| AP7 — Pilot tenant/runtime configuration | **PASS** | Pilot timezone is `Europe/Lisbon`; temporary pilot codes are absent/disabled; known technical fixtures were cleaned; canonical built-in Midweek definitions remain intentionally seeded. Supabase project is healthy. |
| AP8 — Pilot acceptance | **READY, externally blocked** | Repository/domain/frontend integration is complete. Final verdict now depends only on the final authenticated production E2E, three real pilot identities through email login, real iPhone + real Android smoke evidence, and confirming zero unresolved MVP P0/P1 after that run. |

## Integrated repository gates now complete

- KP1–KP8 domain/application queue: **PASS and closed**.
- MP1–MP8 frontend/PWA queue: **PASS and closed**.
- Final frontend acceptance: `docs/PILOT_FRONTEND_ACCEPTANCE.md`.
- Final frontend integration commit: `868c2eb96f13e17678c00851ba5de6fabdca6594`.
- Final MP8 PR head passed both repository `quality` and `browser-regression` before merge.

## Fresh acceptance evidence from this finalization pass

### Supabase project health

- Eutaktos project status: `ACTIVE_HEALTHY`.
- Region: `eu-west-1`.
- Performance advisor: no findings.
- Security advisor: Eutaktos tables report `RLS enabled, no policy` as informational; this matches the current server-only direct-table-access boundary documented in `PILOT_PRINCIPAL_ACCEPTANCE.md`.
- Security advisor also reports leaked-password protection disabled. The pilot is passwordless email; if password auth is added later this must be revisited.

### Current production data hygiene

At the time of the original principal finalization pass:

- active temporary pilot access codes: `0`;
- active non-revoked/unexpired Eutaktos sessions: `0`;
- authorized identities: `1`;
- active capability grants: `13`.

No probe tenant or test identity was left behind by that pass.

### Authentication evidence

Recent Supabase Auth logs from the principal acceptance pass showed:

- successful passwordless email OTP verification/login;
- used/expired one-time tokens fail with `403` / `otp_expired`;
- repeated email requests are rate-limited by the provider when the configured threshold is exceeded;
- Auth log events contain request metadata and account identifiers, but not the one-time token value/token hash.

The scanner-safe Eutaktos flow therefore has evidence for both success and failure paths. Restored active Eutaktos sessions also rotate through `/api/session/rotate` before `AuthBoundary` releases protected application content. The frontend gate fails closed if rotation fails.

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
- `868c2eb96f13e17678c00851ba5de6fabdca6594` — final MP1 correction + MP8 frontend acceptance integration; quality + browser-regression PASS on final PR head.

## What remains before AP8 can become PASS

The previously pending Manus/Grok integration is complete. Remaining work is now only the final real-world acceptance:

1. one final authenticated production E2E across the MVP on the integrated main;
2. three real email identities demonstrating admin / limited operator / ordinary behavior end-to-end;
3. real iPhone smoke evidence;
4. real Android smoke evidence;
5. confirm zero unresolved MVP P0/P1 after the integrated production/device run.

Until those conditions are available, the correct product-level AP8 status remains **BLOCKED**, not a false PASS.
