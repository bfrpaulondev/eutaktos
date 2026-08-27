# Eutaktos Product Experience — Current Inventory

> Principal inventory refreshed 2026-08-27 after final PX9.10/PX9.11 People Map integration.
>
> Current People technical runtime baseline: `main` `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.
> Canonical production acceptance target: `https://eutakes.netlify.app/`.
> Active product source of truth: `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` plus `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md`.

This inventory records current integrated contracts so future Product Experience work reuses them instead of creating parallel models.

## 1. UI foundation

Ant Design 6 is the authoritative runtime component system.

- Runtime MUI/Emotion consumers are retired.
- New Product Experience surfaces must use the existing Ant foundation and semantic Eutaktos tokens.
- Light/Dark/System, pt-PT/en/es, keyboard, responsive/reflow and PWA privacy patterns established in People are the reference for later modules.

## 2. People core/profile contracts

Integrated:

- People list/create/update with server authority;
- Directory 2.0 and People Overview;
- unified Person Profile;
- five-step guided Add/Edit Person;
- normalized labels/tags;
- dedicated ordinary Contact GET/PUT;
- availability/away periods;
- explicit eligibility decisions;
- households;
- service groups;
- responsibility assignments with `[startsAt, endsAt)` semantics;
- emergency contacts under dedicated sensitive capabilities;
- appropriate audit/history views.

Ordinary Contact values remain excluded from the general Directory DTO, URLs, browser storage, service-worker caches and general audit/event values.

## 3. Recommendation and assistance contracts

PX7/PX8 are integrated:

- deterministic server-owned recommendations;
- explicit eligibility, availability, conflicts and completed-history evidence;
- structured reason/warning codes;
- deterministic tie-breaking;
- narrow persistent manual exclusions by tenant/Person/assignment type;
- no subjective positive preference scoring;
- human decision remains final;
- affected-assignment, incomplete-meeting, factual load/rotation and long-interval assistance.

Do not duplicate recommendation logic in the browser or generative AI.

## 4. PX9 People tools

Integrated:

| Capability | Current integrated contract |
| --- | --- |
| Transfers | Secure server-owned send/receive lifecycle; one-time expiring secret; minimum-data payload; no automatic source deletion. |
| Labels/tags | Canonical explicit labels with management/filtering. |
| Reminders | Server-authoritative reminder evidence and queued send intent semantics. |
| Record Cards/reports | Dedicated minimum-data period/year projection with preview. |
| Archive / A não publicar | Explicit reason/date/history and separate restore. |
| Import | Source + preview/validation/duplicate/conflict analysis + authenticated prepare/confirm/execute + create-only rollback/recovery. |
| People Map | Privacy-first approximate manual locations with `map.read`/`map.write`, minimum Map DTO, graphical map + semantic list, group filter/legend. |
| Contact List | Dedicated least-privilege configurable projection/export. |
| Emergency mode | Authorized mobile-first emergency workflow and separate emergency-contact boundary. |
| CSV | Capability-aware export with spreadsheet formula-injection protection. |
| PDF | Direct Record Cards PDF from the already-authorized projection only. |
| DOCX | Deferred/not required unless later user/product evidence establishes a need beyond CSV/PDF. |

## 5. People Map contract inventory

Integrated through PR #392 / main `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.

Authority:

- read: `people.read + map.read`;
- set/remove: `people.write + map.write`;
- `map.read` and `map.write` are sensitive;
- no implicit grant from `tenant.manage`, Contact access or browser state.

Data model:

- tenant-scoped dedicated location persistence;
- one location per tenant + Person;
- `precision = approximate`;
- `source = manual`;
- server validation and normalization to at most two decimal places before persistence;
- no raw higher-precision persistence;
- same-Person mutations serialized for concurrent idempotency.

Privacy:

- no automatic postal-address geocoding;
- no browser/IP/device geolocation;
- no inferred location;
- no Map coordinates added to Directory/Profile/Contact List/Transfers/Record Cards generic DTOs;
- GET Map returns only Person ID, displayName and approximate normalized coordinates;
- archived/non-publishable People excluded;
- no coordinates in general audit/outbox payload metadata;
- no Person/group identity in map tile-provider requests;
- no browser persistence of Map person data.

UI:

- Ant Design 6 People Map entry behind `map.read`;
- Leaflet/OpenStreetMap graphical enhancement lazy-loaded;
- local overlays;
- semantic equivalent list;
- keyboard point/list equivalence;
- locally joined Service Group filter/legend using the existing authorized service-group projection without widening the Map DTO;
- pt-PT/en/es;
- loading/empty/error/retry/401/403/read-only states;
- stale/double-submit guards;
- 320/375/390/430/640/768/1024/1280/1440 responsive/reflow runtime coverage.

## 6. Export/import inventory

Approved People export paths:

- safe CSV where required;
- Record Cards PDF;
- controlled Contact List export.

DOCX is not required for People technical completion. See `docs/PEOPLE_DOCX_EXPORT_DECISION.md`.

User-provided import data follows server-authoritative preview/validation and authenticated execution boundaries. Real personal data must never be committed as repository fixtures or CI evidence.

## 7. Security/privacy invariants

- Tenant, actor and capabilities are server-derived.
- Frontend authority assertions are untrusted.
- Cross-tenant access is rejected before projection/persistence.
- Sensitive responses use no-store.
- PII is not placed in URLs, browser storage, analytics, general logs, service-worker caches or unapproved event/audit values.
- Sensitive projections use least privilege instead of widening generic People DTOs.
- Async mutation surfaces require retry/double-submit/stale-response ownership.
- No inference of spiritual qualification or personal worth.

## 8. Accessibility/acceptance boundary

Automated technical coverage includes responsive/reflow, keyboard semantics where supported, themes/locales and privacy/browser regressions.

Still human/manual:

- real screen-reader acceptance;
- write-capable real-user production walkthrough using approved disposable/real data;
- physical-device evidence when explicitly required.

These are acceptance evidence gaps, not missing People implementation.

## 9. Current engineering direction

People is technically complete and is the Product Experience reference module.

Next recommended module: **Organization 2.0**.

Reuse the existing People households, service groups, responsibilities, session/capability and Ant Design interaction patterns. Do not create competing organization stores or rebuild working People contracts.
