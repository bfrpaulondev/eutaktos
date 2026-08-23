# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-23 after the production-authentication recovery. Read this before taking any Eutaktos task. Historical reports may contain stale deployment or branch information.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`
- Main baseline before the Magic Link follow-up: `4373d29db91ca448827e04681b2400c8a1bee523`
- **Canonical production: `https://eutakes.netlify.app/`**
- `https://rainbow-zuccutto-00d981.netlify.app/` is no longer the production acceptance target.
- Vercel deployments are not Eutaktos production acceptance evidence.

## Integrated recovery state

The recovery work that triaged Manus #190–#200, repaired the visual regression gate, produced the cumulative M60 gate and added the Supabase identity bridge has already been integrated. Do not resurrect those old branches as independent unfinished work.

Important integrated work includes PRs #107, #109, #131, #149, #155, #167, #180, #181, #201, the reviewed Manus recovery PRs, #203 and auth PR #205.

## Current P0

Usable production authentication is the current release gate.

The Supabase identity bridge is already on `main`. A real pilot email was successfully accepted by Supabase Auth, proving email delivery and identity verification, but Supabase redirected the first Magic Link to its stale `http://localhost:3000` Site URL. The follow-up branch `gpt/auth02-magic-link-production` makes the default hosted Magic Link a supported production flow and restores `https://eutakes.netlify.app/` as the canonical origin.

Production configuration must agree on the same origin:

- Netlify: `EUTAKTOS_PUBLIC_ORIGIN=https://eutakes.netlify.app`
- Supabase Authentication URL Configuration: Site URL/allowed redirect for `https://eutakes.netlify.app`

Do not mark authentication DONE until a fresh email link returns to Eutakes, the Eutaktos server creates its own secure session cookie, the Supabase auth fragment is scrubbed from the URL, and authenticated production APIs are exercised.

## Definition of done

`ASSIGNED → IN PROGRESS → PR/REVIEW → INTEGRATED MAIN → DEPLOYED EUTAKES → PRODUCTION VERIFIED → DONE`

A branch, commit, agent report, preview deploy, Supabase login event or green local test alone is not `DONE`.

## Ownership

- Principal/integration agent: main integration, runtime/API/Supabase, production verification and cross-cutting fixes.
- Manus: frontend/PWA-only work when explicitly scoped.
- Kimi: domain/application/in-memory-test work only after explicit user assignment.

Do not dispatch another large Kimi/Manus task wave until authentication and the canonical Eutakes production runtime are verified end to end.

## Immediate next sequence

1. Finish/review the Magic Link production follow-up and merge it only with green quality/browser gates.
2. Deploy the resulting `main` to `https://eutakes.netlify.app/`.
3. Verify health/readiness, signed-out login UI, fresh Magic Link redirect, Eutaktos session creation and URL token scrubbing.
4. Verify the pilot identity binding and active Eutaktos session server-side.
5. Exercise authenticated People/Organization/Access/Audit/Midweek paths with disposable pilot data.
6. Only then resume new parallel feature waves.
