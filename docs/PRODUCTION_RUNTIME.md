# Production runtime

This document describes the V1 server-side runtime introduced for the PWA API. It does not authorize using an unrelated Supabase project or copying real congregation data into test/support systems.

## Required server-only configuration

- `EUTAKTOS_SUPABASE_URL` — dedicated Eutaktos Supabase project URL, HTTPS only.
- `EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY` — server-only service-role credential. Never expose it to the browser.
- `EUTAKTOS_PUBLIC_ORIGIN` — exact HTTPS origin allowed to perform cookie-authenticated mutations.
- `EUTAKTOS_WORKER_TOKEN` — high-entropy bearer token for server-to-server worker invocation.
- `EUTAKTOS_NOTIFICATION_PROVIDER_URL` and `EUTAKTOS_NOTIFICATION_PROVIDER_TOKEN` — optional delivery adapter. If absent, notifications must not be reported as externally delivered.
- `EUTAKTOS_BACKUP_KEY_BASE64` — 32 random bytes encoded as base64, held outside the repository and outside the database backup.

Do not configure these values in `VITE_*` variables.

## Database activation

Apply the migrations in `supabase/migrations` in order to a dedicated Eutaktos project. They create tenant-scoped entities, audit, outbox, access grants and server sessions. Browser roles (`anon` and `authenticated`) receive no direct table access. The server uses the service role and always supplies a tenant derived from the server session.

The persistence RPCs commit entity state, audit and outbox together. Updates/deletes use an observed version to reject stale concurrent writes.

The dedicated Eutaktos Supabase project is now selected and the V1 runtime migrations have been applied. The pilot tenant is bootstrapped there. Runtime activation still depends on each hosting environment having the server-only variables above configured correctly; repository code must remain fail-closed if they are absent.

## Health checks

- `GET /api/health` proves the serverless function runtime is alive. It does not claim the database works.
- `GET /api/ready` returns 200 only when the dedicated database is configured and the runtime schema is reachable. A green static PWA deploy with a failing readiness check is not an operational release.

## Session and request boundary

The browser receives only the `__Host-eutaktos_session` cookie. Tenant, actor and capabilities are reloaded server-side. Session rotation preserves the original absolute expiry and renews only the idle window. Mutations also require an exact same-origin `Origin` and `Sec-Fetch-Site: same-origin` browser request.

API requests are capped at 64 KiB at the shared runtime boundary. A valid caller-provided `X-Correlation-Id` may be preserved; unsafe/free-form values are replaced with a server-generated UUID. The runtime returns `X-Correlation-Id` and writes only allowlisted structured observability metadata. Request bodies, cookies, URLs, tenant/actor identifiers and free-form error messages are not logged by this boundary.

## Scheduling boundary

A06 integrates the reviewed K41–K50 Midweek contracts into the production runtime. `GET /api/midweek` exposes tenant-scoped real meetings and assignments for the PWA. Authenticated mutation routes use the canonical application and transport services for meetings, slots, student and non-student assignments, lifecycle transitions and student/assistant replacement.

Tenant, actor and capabilities come only from the verified server session. Assignment decisions require the canonical `schedule.write`, `eligibility.read` and `availability.read` checks. Reads require `schedule.read`. Scheduling persistence uses the existing atomic entity RPC, so entity state, audit and outbox are committed together and stale writes are rejected through the observed entity version.

Slot conflict windows are derived server-side from the stored meeting date, local time, ordered slot durations and IANA timezone. The browser does not supply a trusted UTC offset. Agenda and Assignments consume the same-origin runtime and expose loading, failure, empty and real-data states without demo fallbacks.

## Pilot tenant

Create a test tenant only after the dedicated database exists and migrations are applied:

```bash
node scripts/bootstrap-pilot.mjs \
  --tenant test-congregation \
  --actor test-admin \
  --display-name "Test Administrator" \
  --locale pt-PT \
  --capability people.read \
  --capability people.write \
  --capability responsibilities.read \
  --capability responsibilities.write \
  --capability audit.read \
  --capability access.manage \
  --capability schedule.read \
  --capability schedule.write \
  --capability eligibility.read \
  --capability availability.read
```

The bootstrap refuses a non-empty tenant and never grants capabilities that were not explicitly listed. Its emitted session token is sensitive and should be handled like a password.

The existing pilot administrator received the four Scheduling capabilities through the audited access-grant RPC; they were not inserted by bypassing the access-control workflow.

## Notifications

K47 defines consent-aware, idempotent notification intent as a domain/application concern and keeps new delivery attempts in `pending`. External delivery is a separate worker/provider concern: no UI or application path may infer `delivered` from the creation of an intent. The worker endpoint is server-to-server authenticated, and provider errors use fixed non-PII codes.

A final acceptance audit must verify that any provider adapter in the deployed runtime consumes the canonical K47 intent/delivery contract before external notification delivery is marked PASS. An absent provider is not a scheduling blocker and must be reported as unavailable/BLOCKED rather than simulated success.

## Backup

Create an encrypted tenant backup:

```bash
node scripts/backup-tenant.mjs --tenant test-congregation --out ./test-congregation.eutaktos.enc
```

The database export is a transactionally consistent tenant snapshot. Sessions and the operational outbox are deliberately excluded: restores must never resurrect authentication state or replay stale notifications. The file is encrypted with AES-256-GCM before being written.

Restore only after verifying both the target tenant and the backup:

```bash
node scripts/restore-tenant.mjs \
  --tenant test-congregation \
  --in ./test-congregation.eutaktos.enc \
  --confirm-restore
```

Restore replaces tenant entities, audit and access grants in one database transaction, removes all pre-existing sessions and clears pending outbox work for that tenant. Users must authenticate again and any post-restore notification work must be regenerated from current application actions.

## Activation status

The dedicated Eutaktos database, migrations and pilot tenant exist. A disposable Scheduling transaction probe confirmed create/update optimistic versioning plus audit/outbox atomicity and was rolled back afterwards. Hosting environments must still be validated independently for server-only configuration, readiness and authenticated browser flows; a successful static deploy alone is not evidence that secrets or sessions are configured correctly.
