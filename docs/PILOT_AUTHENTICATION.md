# Pilot authentication

This runbook defines the controlled V1 sign-in path. It does not enable public self-registration.

## Architecture

1. Supabase Auth proves control of a pre-authorized email address with its hosted passwordless email flow.
2. The production email uses a scanner-safe token-hash link that lands on Eutaktos without consuming the one-time token. The token is consumed only after the human presses the explicit confirmation button in Eutaktos. Six-digit email OTP remains supported as a fallback when a template/provider is configured to render `{{ .Token }}`.
3. The Eutaktos server resolves the verified email to a server-side `tenant_id` and `actor_id` in `eutaktos_auth_identities`.
4. The first successful exchange binds the Supabase Auth user UUID to that Eutaktos identity.
5. Eutaktos creates its own opaque server session and returns only the `__Host-eutaktos_session` HttpOnly/Secure/SameSite cookie to the browser.
6. Tenant, actor and capabilities are always reloaded server-side. The browser never supplies trusted tenant, actor or capability values.

Supabase access and refresh tokens must never be returned by the Eutaktos API, persisted in browser storage or logged. The scanner-safe flow keeps only the `token_hash` in React memory long enough for an explicit user-confirmed POST, scrubs it from the visible URL before any verification request, and exchanges it server-side with Supabase. The legacy implicit-fragment exchange remains supported temporarily for already-issued links but is not the production email-template target.

## Canonical pilot origin

The production origin is `https://eutakes.netlify.app`.

Netlify must set:

```text
EUTAKTOS_PUBLIC_ORIGIN=https://eutakes.netlify.app
```

Supabase Authentication URL Configuration must use the same production origin as the Site URL and allowed redirect destination. `/api/auth/otp` supplies `https://eutakes.netlify.app/auth/confirm` explicitly as the passwordless redirect.

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

### Required scanner-safe Magic Link template

Do **not** use `{{ .ConfirmationURL }}` directly as the clickable email link. Corporate email gateways, Gmail safety checks and other link scanners can follow that URL before the user does and consume its one-time token.

Configure **Authentication → Email Templates → Magic Link** so the clickable URL is built from the Eutaktos redirect plus `{{ .TokenHash }}`:

```html
<h2>Your sign-in link</h2>
<p>Follow the link below to continue signing in. The link can only be used once.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Continue to Eutaktos</a>
</p>
```

`{{ .RedirectTo }}` is supplied by `/api/auth/otp` as:

```text
https://eutakes.netlify.app/auth/confirm
```

A scanner may open that Eutaktos URL, but page load alone does not call Supabase verification. Eutaktos removes the token hash from the address bar and waits for an explicit human click on **Confirm sign-in / Entrar no Eutaktos**. Only that button sends the token hash to the server for one-time verification.

If a later provider/template renders `{{ .Token }}`, the existing six-digit OTP verification path remains available.

The Eutaktos `/api/auth/otp` endpoint requests `create_user=true` only for an email already present in `eutaktos_auth_identities` and not yet bound to an Auth UUID. Unknown emails receive the same generic HTTP response but no Auth account is created.

## Browser flow

Primary scanner-safe Magic Link flow:

- `POST /api/auth/otp` body: `{ "email": "..." }`
- Supabase sends a link to `/auth/confirm?token_hash=...&type=email` using the template above.
- Eutaktos captures the token hash in memory and immediately removes it from the visible URL/history entry.
- **No verification request occurs on page load.** This is the scanner-safety boundary.
- the confirmation page requires a real button click.
- only after that click, the browser sends `POST /api/auth/verify` with `{ "tokenHash": "..." }`.
- the server exchanges the token hash at Supabase Auth `/auth/v1/verify` with `{ "type": "email", "token_hash": "..." }`, resolves the pre-authorized identity, binds the Auth UUID when appropriate, and creates the Eutaktos session.
- successful verification returns the normal Eutaktos session DTO (`actorId`, `capabilities`) and sets `__Host-eutaktos_session`.

Legacy implicit Magic Link compatibility:

- previously issued Supabase links may redirect with an `#access_token=...` fragment.
- Eutaktos still scrubs the fragment immediately and exchanges only that transient access token through `/api/auth/verify`.
- this compatibility path must not be used by the production email template after the scanner-safe template is configured.

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
6. the Supabase Magic Link email template uses `{{ .TokenHash }}` and `{{ .RedirectTo }}` as documented above, not a direct `{{ .ConfirmationURL }}` href.
7. opening the link shows the Eutaktos confirmation page without consuming the token; pressing the confirmation button once creates the Eutaktos session.
8. no Supabase token or token hash remains in browser history, localStorage, sessionStorage, IndexedDB, Cache Storage, telemetry or application logs.
9. verify sign-in, session refresh/rotation, logout and logout-all against disposable pilot data before admitting real congregation data.

## Passkeys and MFA

The security architecture still targets passkeys/WebAuthn and MFA. The pilot passwordless email bridge is an initial usable identity path, not the final GA authentication gate. Passkeys must not be made the sole production dependency while provider support remains experimental; privileged MFA requirements remain release-blocking where configured.
