# Eutaktos — principal pilot-readiness acceptance

Date: 2026-08-24

Canonical production: `https://eutakes.netlify.app/`

Initial audited `main`: `4fd9a0abde133084153f8ca8db549368914f6430`

Principal queue: #237 (`AP1`–`AP8`)

This document records only evidence that was actually observed. It does not convert missing physical-device, mailbox or parallel-agent evidence into PASS.

## Status vocabulary

- **PASS** — directly demonstrated by automated test, production probe, database drill or observed production flow.
- **FAIL** — expected pilot behavior is known to be broken.
- **BLOCKED** — the implementation/evidence requires another active workstream, external account/device or a later integrated main.
- **NOT TESTED** — no suitable environment was available to prove it safely.

## AP matrix

| Task | Status | Evidence |
| --- | --- | --- |
| AP1 — production readiness | **PASS** | Canonical production shell and direct `/pessoas` deep link returned 200 with absolute `/assets/...`; `/api/health` returned `200 {status: ok, service: eutaktos-api}`; `/api/ready` returned `200 {status: ready, database: reachable}`. Unauthenticated protected reads fail closed. The temporary external CI smoke was removed after evidence because external network resets must not make normal CI flaky. |
| AP2 — authentication edge cases | **BLOCKED** | Real scanner-safe Magic Link login was observed in production and Supabase Auth logs show a successful email OTP verification/login. Unknown-email request remains enumeration-resistant; invalid/expired token hash maps to generic Unauthorized; CSRF provenance is required. Permanent tests now cover idle expiry, absolute expiry, revocation, malformed expiry, secure cookie and server-derived capabilities. Temporary database-backed pilot access codes are disabled by default in code. **Remaining blocker:** frontend currently exposes `SessionApi.rotate()` but no production caller was found; safe active-session rotation is assigned to the frontend pilot queue before final acceptance. |
| AP3 — availability/eligibility/scheduling persistence | **PASS** | Sanitized disposable-tenant production-DB drill created a person, persisted an away period, persisted explicit eligibility using the previously problematic subresource audit ID (`personId:assignmentTypeId`), created a Midweek entity, then proved a stale write fails without entity/audit/outbox side effects. Probe residue after cleanup: zero entities/audit/outbox. |
| AP4 — multi-user role matrix | **BLOCKED** | Production-DB disposable role drill successfully created admin/limited/ordinary actors, pre-authorized identities, server sessions and least-privilege capability sets; unknown identity and auth-UUID binding mismatch failed closed. Probe residue: zero. **Remaining blocker:** real email login through three independent mailboxes is not simulated; it requires two additional authorized test mailboxes during final pilot acceptance. |
| AP5 — backup/export/restore drill | **PASS** | Real production-DB sanitized tenant was exported with `eutaktos_export_tenant`, deliberately mutated, restored with `eutaktos_restore_tenant`, and re-exported. Snapshot equivalence was verified excluding `exportedAt`; relationships/IDs were preserved and sessions/outbox were not restored. All probe entities/audit/grants/sessions/outbox were removed. |
| AP6 — final production E2E | **BLOCKED** | Real user Magic Link -> Eutaktos session -> protected People UI has been manually observed, and prior focused production tests exercised CRUD/scheduling. A final clean authenticated cross-module E2E must run again after Manus/Grok pilot work is integrated; session credentials are not committed or exposed to CI. |
| AP7 — pilot tenant/runtime configuration | **PASS** | Pilot timezone changed through the atomic audited persistence RPC from UTC to `Europe/Lisbon`; version advanced to 3, audit records only `timezone`, and `CongregationUpdated` exists. Existing meeting times were preserved rather than guessed. Expired/consumed temporary pilot-code rows were removed (zero remain); backend temporary-code fallback is now opt-in only. Known E2E/A06 active fixtures and their known pre-pilot fixture history were cleaned. Built-in Midweek part definitions remain intentionally seeded. |
| AP8 — integrated pilot acceptance | **BLOCKED** | Principal runtime work can be integrated after CI is green, but pilot acceptance cannot be declared until accepted Manus/Grok pilot PRs are integrated and the final desktop + real iPhone + real Android smoke and real multi-mailbox role check are completed. |

## Production/runtime evidence

### Readiness

The readiness endpoint is factual: it constructs the configured `SupabaseRestDatabase` and performs a real read against the production entities table. It returns 503 for missing/misconfigured/unreachable database state and 200 only when the database is reachable.

Observed against canonical production during this acceptance:

- PWA root: 200.
- `/pessoas` direct deep link: 200.
- `/api/health`: 200.
- `/api/ready`: 200, database reachable.
- protected unauthenticated People/Midweek/Audit/Access reads: Unauthorized.

The external smoke experienced transient runner `ECONNRESET` on later repeated probes. Because earlier calls in the same gate had already proven the responses, the external-only test was intentionally removed rather than making every repository CI run depend on Netlify/network availability.

### Authentication

The pilot architecture remains:

1. Supabase Auth proves control of a pre-authorized email.
2. scanner-safe TokenHash lands on `/auth/confirm` without consuming the token on GET;
3. explicit human confirmation performs the verification POST;
4. Eutaktos resolves tenant/actor server-side and creates an opaque Host-only session cookie;
5. capabilities are reloaded from server-side grants.

Permanent server tests additionally prove that idle-expired, absolute-expired, revoked and malformed-expiry sessions fail closed.

Temporary locally issued six-digit pilot access codes are **disabled by default**. They may only be considered when the server environment explicitly sets:

`EUTAKTOS_ENABLE_TEMPORARY_PILOT_ACCESS_CODES=true`

The pilot production environment should leave this unset/false. This does not disable legitimate six-digit OTP verification supplied by Supabase Auth.

### Database direct-access boundary

Supabase Advisor reports `RLS enabled, no policy` as INFO for the Eutaktos tables. This is intentional for the current server-only architecture rather than a missing browser policy.

Verified for every current `public.eutaktos_*` table:

- RLS enabled;
- `anon`: no SELECT/INSERT/UPDATE table privilege;
- `authenticated`: no SELECT/INSERT/UPDATE table privilege.

The browser therefore does not receive direct table access. Sensitive operations continue through the Eutaktos API using server-side authorization.

Supabase performance advisor: no findings during this acceptance.

Supabase security advisor also reports leaked-password protection disabled. The pilot uses passwordless email, so this is not a passwordless-flow blocker. If password authentication is enabled later, leaked-password protection must be enabled/reviewed before release.

## Backup/restore pilot procedure

The canonical tenant export deliberately contains operational entities, audit and access grants. It does not restore live sessions or outbox delivery state.

Pilot operational target (not a provider SLA):

- **RPO target:** 24 hours; create at least one canonical export per pilot day in which material data changes, and before significant migration/configuration changes.
- **RTO target:** 60 minutes once a valid snapshot is available to an authorized operator.
- keep snapshots outside the public web root and handle them as sensitive congregation data;
- never commit real snapshots to Git;
- periodically repeat the restore drill against a disposable tenant.

The restore mechanism itself passed a real round-trip in this acceptance. Automating encrypted off-platform snapshot scheduling remains a later production-hardening item; it does not replace the tested canonical export/restore path.

## Pre-pilot sanitation completed

The following known technical fixtures were removed from active pilot state:

- prior E2E person/household/service-group/responsibility fixtures;
- leftover E2E test grant;
- `a06-runtime-validation` Midweek meeting;
- expired/consumed temporary pilot access codes;
- known fixture audit/outbox rows tied to the explicit E2E/A06 IDs.

Disposable AP3/AP4/AP5 probe tenants were verified at zero residue after their tests.

Existing data that could not safely be classified as a technical fixture was deliberately preserved.

## Parallel-work blockers handed off

Frontend queue #235 was explicitly notified of two principal findings:

1. safe authenticated session rotation must be wired into production UI behavior before the 30-minute idle boundary while preserving the absolute session limit;
2. the temporary test-code affordance must not remain presented as a normal production sign-in route.

Domain/application pilot work is isolated to the Grok KP queue and must be reviewed before AP8.

## Final AP8 exit conditions

The principal agent may declare the controlled MVP pilot ready only after all of the following are true on one integrated `main`:

- principal PR CI quality + browser regression are green;
- accepted Manus MP1–MP8 work is integrated with no frontend P0/P1;
- accepted Grok KP1–KP8 work is integrated with no domain/application P0/P1;
- final authenticated production E2E passes across Auth, People, Organization, Responsibilities, Availability, Eligibility, Access/Audit, Agenda/Assignments, deep-link/refresh/logout;
- three real pilot identities demonstrate admin/limited/ordinary behavior through the email login path;
- backup/restore remains PASS;
- desktop, real iPhone and real Android smoke are recorded;
- no unresolved MVP P0/P1 remains.

Until those external/parallel conditions are met, the correct principal verdict is **BLOCKED at AP8**, not a false 100% PASS.
