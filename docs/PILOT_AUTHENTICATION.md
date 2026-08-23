# Pilot authentication

This runbook defines the controlled V1 sign-in path. It does not enable public self-registration.

## Architecture

1. Supabase Auth proves control of a pre-authorized email address with its hosted passwordless email flow.
2. The default hosted flow sends a one-time Magic Link. Six-digit email OTP remains supported as a fallback when a template/provider is configured to render `{{ .Token }}`.
3. The Eutaktos server resolves the verified email to a server-side `tenant_id` and `actor_id` in `eutaktos_auth_identities`.
4. The first successful exchange binds the Supabase Auth user UUID to that Eutaktos identity.
5. Eutaktos creates its own opaque server session and returns only the `__Host-eutaktos_session` HttpOnly/Secure/SameSite cookie to the browser.
6. Tenant, actor and capabilities are always reloaded server-side. The browser never supplies trusted tenant, actor or capability values.

Supabase access and refresh tokens must never be returned by the Eutaktos API, persisted in browser storage or logged. For the implicit Magic Link flow, the browser reads the short-lived access token from the Supabase redirect fragment only long enough to POST it to `/api/auth/verify`, immediately removes the auth fragment from the visible URL/history entry, and never stores or uses the refresh token.

## Canonical pilot origin

The production origin is `https://eutakes.netlify.app`.

Netlify must set:

```text
EUTAKTOS_PUBLIC_ORIGIN=https://eutakes.netlify.app
```

Supabase Authentication URL Configuration must use the same production origin as the Site URL and/or allowed redirect destination. `/api/auth/otp` also supplies the configured Eutaktos public origin explicitly as the passwordless email redirect.

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

## Passwordless email provider configuration

Email authentication must remain enabled in the dedicated Eutaktos Supabase project.

The default hosted Supabase template sends a Magic Link. This is a supported Eutaktos production path and does not require custom SMTP. If a later provider/template renders `{{ .Token }}`, the existing six-digit OTP verification path remains available.

The Eutaktos `/api/auth/otp` endpoint requests `create_user=true` only for an email already present in `eutaktos_auth_identities` and not yet bound to an Auth UUID. Unknown emails receive the same generic HTTP response but no Auth account is created.

## Browser flow

Primary Magic Link flow:

- `POST /api/auth/otp` body: `{ "email": "..." }`
- Supabase sends a one-time link redirected to the configured Eutaktos production origin.
- the browser immediately removes the Supabase auth fragment from the URL and sends only the transient `access_token` to `POST /api/auth/verify` as `{ "accessToken": "..." }`.
- the server validates that access token against Supabase Auth `/auth/v1/user`, resolves the pre-authorized identity, binds the Auth UUID when appropriate, and creates the Eutaktos session.
- successful verification returns the normal Eutaktos session DTO (`actorId`, `capabilities`) and sets `__Host-eutaktos_session`.

Optional six-digit OTP fallback:

- `POST /api/auth/verify` body: `{ "email": "...", "token": "123456" }`

Neither verification form accepts tenant, actor or capability input. All auth mutation endpoints require the existing same-origin CSRF boundary.

## Binding and MFA behavior

On first successful verified passwordless authentication, the server atomically binds the verified Supabase Auth UUID to the pre-authorized Eutaktos identity while creating the Eutaktos session. Later attempts with a different Auth UUID for the same mapping are rejected.

When `mfa_required=true`, `aal1` authentication is rejected. The session RPC accepts only `aal1` or `aal2`; privileged pilot identities should move to AAL2 before production use where required by policy.

## Operational checks

Before enabling a pilot identity:

1. `GET /api/health` is 200.
2. `GET /api/ready` is 200 and database is reachable.
3. the auth identity migration is applied.
4. the target actor is active and has only the intended Eutaktos capabilities.
5. Supabase Site URL/redirect allow-list and Netlify `EUTAKTOS_PUBLIC_ORIGIN` agree on the production origin.
6. a fresh Magic Link returns to Eutaktos, is exchanged once, and leaves no Supabase auth fragment in the URL.
7. no Supabase token appears in localStorage, sessionStorage, IndexedDB, Cache Storage, telemetry or application logs.
8. verify sign-in, session refresh/rotation, logout and logout-all against disposable pilot data before admitting real congregation data.

## Passkeys and MFA

The security architecture still targets passkeys/WebAuthn and MFA. The pilot passwordless email bridge is an initial usable identity path, not the final GA authentication gate. Passkeys must not be made the sole production dependency while provider support remains experimental; privileged MFA requirements remain release-blocking where configured.
