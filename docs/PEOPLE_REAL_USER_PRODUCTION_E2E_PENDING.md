# People — Real-user production E2E acceptance pending

This document records validation that must be performed later by an independent agent using the canonical production site `https://eutakes.netlify.app/` and an authorized disposable/QA user/data set.

These checks are intentionally **not** considered complete from mocked, local, CI, preview-only, or source inspection evidence.

## Rules

- Do not use real congregation PII when disposable/sanitized QA data is sufficient.
- Do not make destructive production changes without an approved disposable fixture and explicit rollback/cleanup plan.
- Prove the production deployment SHA/assets before claiming acceptance.
- Record exact production URL, SHA/deploy evidence, browser, viewport, locale/theme, account capability profile and created/changed fixture IDs in the acceptance report.
- Clean up every disposable mutation when the workflow supports safe cleanup.

## PX6 — Guided Add/Edit Person

Execute an end-to-end real-user walkthrough in production:

1. Open People Directory.
2. Add a disposable person.
3. Complete Identity.
4. Add/edit ordinary Contact fields (phone/email/address as permitted).
5. Configure household/service group.
6. Assign a dated responsibility, verify it appears, then end/replace it using the supported canonical flow.
7. Configure explicit eligibility.
8. Add a dated absence period, verify it appears, then remove/correct it using the supported canonical flow.
9. Review the pending changes and confirm no tenant/actor/capability IDs or unnecessary PII are exposed.
10. Save once; verify no duplicate resource is created by rapid repeated interaction.
11. Refresh and confirm authoritative persisted state.
12. Re-open Edit and verify the same mental model and persisted values.
13. Exercise a safe retry scenario if the environment provides a controlled way to do so.
14. Verify Back/Forward/Cancel and unsaved-change protection.
15. Inspect URL, localStorage, sessionStorage, Cache Storage and service-worker behavior for Contact PII leakage.
16. Repeat key read-only behavior with a reduced-capability account where available, proving 401/403 surfaces rather than fabricated empty data.

## PX7/PX8/PX9/PX10 follow-up

As later People capabilities are integrated, append the exact production-only scenarios that require a real authenticated user, real deployment and/or safe write-capable fixture. Automated/browser-sanitized evidence may support but must not replace this acceptance category.

## Closure rule

A Product Experience checkbox requiring a real-user production walkthrough remains pending until an independent report proves the exact workflow against canonical production. Principal agents must not infer completion from CI, preview, unit tests or sanitized local runtime alone.
