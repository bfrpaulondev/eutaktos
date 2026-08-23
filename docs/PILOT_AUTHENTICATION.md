# Pilot authentication

This runbook defines the controlled V1 sign-in path. It does not enable public self-registration.

## Architecture

1. Supabase Auth proves control of a pre-authorized email address with an email OTP.
2. The Eutaktos server resolves that email to a server-side `tenant_id` and `actor_id` in `eutaktos_auth_identities`.
3. The first successful exchange binds the Supabase Auth user UUID to that Eutaktos identity.
4. Eutaktos creates its own opaque server session and returns only the `__Host-eutaktos_session` HttpOnly/Secure/SameSite cookie to the browser.
5. Tenant, actor and capabilities are always reloaded server-side. The browser never supplies trusted tenant, actor or capability values.

Supabase access and refresh tokens must never be returned by the Eutaktos API, persisted in browser storage or logged.

## Pre-authorize a pilot identity

The person must already exist as an active `person` entity in the target tenant. Run the server-only RPC with the dedicated Eutaktos service credential or through an authorized operator connection:

```sql
select public.eutaktos_preapprove_auth_identity(
  'pilot-eutaktos',
  'pilot-admin',
  'person@example.com',
  false
);
```

Set the final argument to `true` only when that identity must reach AAL2 before an Eutaktos session can be created.

The RPC refuses a missing/inactive actor. A pre-authorization does not itself create an Auth user, a session or any new capability.

## Email OTP provider configuration

Email authentication must remain enabled in the dedicated Eutaktos Supabase project. The sign-in template must render the OTP token (`{{ .Token }}`) rather than relying only on a magic-link URL.

The Eutaktos `/api/auth/otp` endpoint requests `create_user=true` only for an email already present in `eutaktos_auth_identities` and not yet bound to an Auth UUID. Unknown emails receive the same generic HTTP response but no Auth account is created.

## Browser flow

- `POST /api/auth/otp` body: `{ "email": "..." }`
- `POST /api/auth/verify` body: `{ "email": "...", "token": "123456" }`
- successful verification returns the normal Eutaktos session DTO (`actorId`, `capabilities`) and sets `__Host-eutaktos_session`.
- neither endpoint accepts tenant, actor or capability input.
- both mutation endpoints require the existing same-origin CSRF boundary.

## Binding and MFA behavior

On first successful OTP verification, the server atomically binds the verified Supabase Auth UUID to the pre-authorized Eutaktos identity while creating the Eutaktos session. Later attempts with a different Auth UUID for the same mapping are rejected.

When `mfa_required=true`, `aal1` authentication is rejected. The session RPC accepts only `aal1` or `aal2`; privileged pilot identities should move to AAL2 before production use where required by policy.

## Operational checks

Before enabling a pilot identity:

1. `GET /api/health` is 200.
2. `GET /api/ready` is 200 and database is reachable.
3. the auth identity migration is applied.
4. the target actor is active and has only the intended Eutaktos capabilities.
5. the OTP email template/provider is configured and tested.
6. no Supabase token appears in browser localStorage, sessionStorage, IndexedDB, Cache Storage, URL, telemetry or application logs.
7. verify sign-in, session refresh/rotation, logout and logout-all against disposable pilot data before admitting real congregation data.

## Passkeys and MFA

The security architecture still targets passkeys/WebAuthn and MFA. The pilot email-OTP bridge is an initial usable identity path, not the final GA authentication gate. Passkeys must not be made the sole production dependency while provider support remains experimental; privileged MFA requirements remain release-blocking where configured.
