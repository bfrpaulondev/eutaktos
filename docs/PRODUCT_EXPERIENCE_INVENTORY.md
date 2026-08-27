# Eutaktos Product Experience — Current Inventory

> Principal inventory refreshed on 2026-08-27 after PX9.3 Labels and full Ant Design 6/MUI retirement.
>
> Current baseline: `main` `4d6f0cd09f4567cf4ca8870f782308c144e7345e`.
> Active product source of truth: `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` plus `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` for the current integrated state.
> Canonical production: `https://eutakes.netlify.app/`.

This inventory records what already exists so Product Experience work reuses current contracts instead of creating parallel models or reimplementing completed work.

## 1. UI foundation

Ant Design 6 is the authoritative runtime component system.

- Runtime MUI/Emotion consumers have been retired.
- `@mui/material` and Emotion runtime dependencies have been removed from the web PWA.
- Regression coverage prevents accidental reintroduction of the retired framework.
- New Product Experience work must use the existing Ant foundation and semantic Eutaktos tokens.

## 2. People core and profile contracts

### People core

Current People API/application behavior covers:

- list people;
- create person;
- update person;
- `id`, `displayName`, optional `preferredLocale`, `active`;
- explicit normalized **labels/tags** through the canonical People contract.

Labels are server-owned data. The Directory can manage and locally filter the authorized returned labels, with privacy and authority regression coverage. Do not create a second label store.

### Ordinary Contact

Dedicated per-person ordinary Contact contract:

- `GET /api/people/:personId/contact`;
- `PUT /api/people/:personId/contact` as full replacement;
- optional phone/email/address;
- `people.read` for read and `people.read + people.write` plus trusted same-origin mutation guard for write;
- Contact values remain excluded from the general Directory DTO, URL, browser storage, service-worker cache and audit/event values.

### Availability / away periods

Current `availabilityApi` exposes per-person:

- list periods;
- add a period;
- remove a period;
- explicit `startsAt`, `endsAt`, optional `reasonCode` (`away`, `unavailable`, `other`).

Any period covering the relevant time is operational unavailability; `reasonCode` is descriptive and must not be reinterpreted as permission to ignore a period.

### Eligibility

Current `eligibilityApi` exposes per-person:

- list explicit assignment-type decisions;
- set `assignmentTypeId` + `enabled`;
- `decidedAt` evidence.

Missing eligibility data must never be treated as positive eligibility.

### Households

Current `householdsApi` exposes list/get/create/update/delete with `id`, `name`, `memberIds`.

### Service groups

Current `serviceGroupsApi` exposes list/get/create/update/delete with `id`, `name`, `memberIds`, optional `overseerId`, optional `assistantId`.

### Responsibilities

Current `responsibilitiesApi` exposes:

- list/get assignments;
- assign responsibility;
- end responsibility;
- `personId`, `responsibilityKey`, `startsAt`, optional `endsAt`;
- canonical `[startsAt, endsAt)` semantics.

### Emergency contacts

Current `emergencyContactsApi` exposes per-person list/create/update/delete with `name`, `phone`, optional `relationship`.

This remains sensitive data behind `emergency-contacts.read/write`; it must not become a default Directory or AI payload.

### Assignment evidence and recommendations

Current meeting/assignment contracts plus the PX7 server adapter provide:

- current and completed assignment evidence;
- explicit eligibility, availability and conflict facts;
- deterministic candidate ranking with reasons/warnings;
- tenant/capability isolation;
- human-final-decision semantics.

PX7.8 persistent manual exclusions/preferences remain absent and must not be invented in browser state.

## 3. Operational assistance

PX8 is implemented from authoritative operational facts, including affected assignment by absence, incomplete meeting attention, workload/rotation facts and long-interval insight. Assistance remains advisory, dismissible/navigable and does not autonomously assign.

## 4. Import / recovery inventory

Implemented:

- supported import source selection;
- server-authoritative preview and validation;
- duplicate/conflict analysis;
- dry-run/recovery boundary.

Not implemented intentionally:

- durable execute/rollback, because the current architecture still lacks the required atomic transaction + migration log + persisted rollback plan. Do not expose execute/rollback routes until that architecture exists.

## 5. Notification/reminder inventory

`NotificationIntentService` already supports `kind: 'reminder'` for assignment notification intents and provides:

- server capability enforcement via `schedule.write`;
- server-derived tenant/actor context;
- recipient notification preferences;
- deterministic idempotency key per source event/recipient/channel;
- audit and domain-event emission;
- no duplicate intent when the idempotency key already exists.

Missing for PX9.4:

- an authoritative read model/repository query for **who needs a reminder**;
- an explicit operational **reason** contract;
- authoritative **last reminder date/status** derived from delivery history;
- a read API consumed by the UI before the send action.

The UI must not infer these from browser-local history.

## 6. Remaining PX9 contracts/gaps

| Target capability | Current status | Required next action |
| --- | --- | --- |
| Transfers send/receive | No complete People transfer contract | Define tenant-safe transfer aggregate/persistence, explicit selected-person scope, secure one-time/expiring receive token lifecycle, status/history, audit and replay protections before UI. |
| Labels/tags | **Integrated** | Reuse canonical People labels contract and Directory UI; do not create a parallel label model. |
| Reminders | Notification send intent exists; read model missing | Build authoritative reminder-needed/reason/last-reminder read contract, then UI and send confirmation using existing notification intent path. |
| Archive / do-not-publish | `active` flag exists but is insufficient | Define reason/date/audit/restore persistence and visibility semantics before UI. |
| Record cards/reports | No approved report schema | Define permitted fields, year/period semantics, preview and export privacy contract. |
| People map | Technically ready for Principal review on PR #392 | Reuse `docs/PEOPLE_MAP_CONTRACT.md`, dedicated `people-map-v1` approximate manual location persistence, `GET /api/people/map`, `PUT`/`DELETE /api/people/:personId/map-location`, `people.read + map.read` for read and `map.write` for mutation. CI quality/browser-regression and canonical `netlify/eutakes` preview passed on People Map implementation commit `7259c5daf3d4f835739825beed6f7f817e782ac8`; Principal integration and human acceptance remain separate. |
| Configurable Contact List | Ordinary Contact exists but is least-privilege per-person | Define dedicated server projection/export contract; never widen general Directory DTO with contact PII for convenience. |
| CSV export | Directory CSV exists with formula-injection protection | Reuse where sufficient; add fields only after privacy/authority review. |
| PDF export | No approved general People report contract | Implement only against a reviewed report/contact-list projection. |
| DOCX export | Product need not established | Defer unless user testing confirms a real need. |

## 7. Security/privacy invariants

- Tenant, actor and capabilities are server-derived.
- Do not trust frontend authority assertions.
- Do not put PII in URL/search, browser storage, analytics, logs, audit values, domain-event values or service-worker cache.
- Private authenticated API responses are not PWA-cached.
- Sensitive projections use least privilege rather than widening general People DTOs.
- Retry/double-submit/stale-response ownership must be explicit for every new async mutation surface.
- pt-PT/en/es and WCAG 2.2 AA remain release requirements.

## 8. Safe next engineering order

1. Preserve current green People/PX baseline.
2. Build PX9.4 authoritative reminder read model before adding reminder UI; reuse existing notification intent send path.
3. Preserve the approved People Map privacy boundary: no ordinary Contact geocoding, browser/IP location, raw-coordinate logging or implicit map privileges.
4. Keep PX9.17 DOCX research-deferred until product evidence demonstrates a need beyond CSV/PDF.
5. Leave real-user production writes and real screen-reader acceptance to `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`.
