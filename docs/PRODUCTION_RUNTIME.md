# Production runtime

This document describes the V1 server-side runtime introduced for the PWA API. It does not authorize using an unrelated Supabase project or copying real congregation data into test/support systems.

## Required server-only configuration

- `EUTAKTOS_SUPABASE_URL` — dedicated Eutaktos Supabase project URL, HTTPS only.
- `EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY` — server-only service-role credential. Never expose it to the browser.
- `EUTAKTOS_PUBLIC_ORIGIN` — exact HTTPS origin allowed to perform cookie-authenticated mutations.
- `EUTAKTOS_WORKER_TOKEN` — high-entropy bearer token for server-to-server worker invocation.
- `EUTAKTOS_NOTIFICATION_PROVIDER_URL` and `EUTAKTOS_NOTIFICATION_PROVIDER_TOKEN` — optional delivery adapter. If absent, notifications stay pending/failed; the runtime never reports external delivery success.
- `EUTAKTOS_BACKUP_KEY_BASE64` — 32 random bytes encoded as base64, held outside the repository and outside the database backup.

Do not configure these values in `VITE_*` variables.

## Database activation

Apply the migrations in `supabase/migrations` in order to a dedicated Eutaktos project. They create tenant-scoped entities, audit, outbox, access grants and server sessions. Browser roles (`anon` and `authenticated`) receive no direct table access. The server uses the service role and always supplies a tenant derived from the server session.

The persistence RPCs commit entity state, audit and outbox together. Updates/deletes use an observed version to reject stale concurrent writes.

## Health checks

- `GET /api/health` proves the serverless function runtime is alive. It does not claim the database works.
- `GET /api/ready` returns 200 only when the dedicated database is configured and the runtime schema is reachable. A green static PWA deploy with a failing readiness check is not an operational release.

## Session and request boundary

The browser receives only the `__Host-eutaktos_session` cookie. Tenant, actor and capabilities are reloaded server-side. Session rotation preserves the original absolute expiry and renews only the idle window. Mutations also require an exact same-origin `Origin` and `Sec-Fetch-Site: same-origin` browser request.

API requests are capped at 64 KiB at the shared runtime boundary. A valid caller-provided `X-Correlation-Id` may be preserved; unsafe/free-form values are replaced with a server-generated UUID. The runtime returns `X-Correlation-Id` and writes only allowlisted structured observability metadata. Request bodies, cookies, URLs, tenant/actor identifiers and free-form error messages are not logged by this boundary.

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
  --capability access.manage
```

The bootstrap refuses a non-empty tenant and never grants capabilities that were not explicitly listed. Its emitted session token is sensitive and should be handled like a password.

## Notifications

Domain/application code writes events to the transactional outbox. The worker endpoint only accepts authenticated server-to-server calls and only attempts event types prefixed `notification.` with schema version 1. Provider calls include the event ID as an idempotency key. Rejected/unavailable providers are recorded with fixed non-PII error codes and the event is not marked delivered.

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

## Current activation blocker

Code readiness and environment activation are separate. Do not point this runtime at another product's Supabase project. A dedicated Eutaktos project (or an explicitly approved existing Eutaktos project) must be selected before migrations, pilot bootstrap, backup drill or production writes are executed.
