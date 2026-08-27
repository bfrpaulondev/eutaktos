# People technical closeout audit — 2026-08-27

> Audit baseline: `main` `39d396c812a9db79f5c405b5b635d5bafe89b6ed`.
> Canonical production acceptance target: `https://eutakes.netlify.app/`.

## Purpose

This audit separates four different states that older planning documents currently mix together:

1. technical work already integrated on `main`;
2. the one active remaining People implementation slice;
3. intentionally deferred/non-required product research;
4. human acceptance that cannot be truthfully replaced by automated CI.

It is deliberately additive and does not rewrite the shared source-of-truth files while PX9.10/PX9.11 Map is being completed in parallel.

## Technical baseline already integrated

The current `main` ancestry includes the reviewed People product work for:

- People core/profile, guided add/edit and organization/participation flows;
- deterministic explainable recommendations and persistent manual exclusions;
- responsible-person assistance;
- Labels/tags;
- Reminders;
- Archive / “A não publicar”;
- Hourglass source/preview plus authenticated prepare → confirm → execute and create-only rollback;
- Contact List;
- emergency mode/emergency contacts;
- CSV export;
- Record Cards/reports;
- direct Record Cards PDF export;
- secure People Transfers;
- Ant Design 6 migration and MUI/Emotion runtime retirement;
- automated responsive/keyboard/privacy and 200%/400% People reflow coverage;
- stabilized Person Profile browser refresh regression.

The privacy-first PX9.10/PX9.11 Map contract is also integrated on this baseline through PR #389 / main `39d396c812a9db79f5c405b5b635d5bafe89b6ed`.

## Active technical implementation remaining

### PX9.10/PX9.11 People Map

This is the only active product implementation slice still required for People technical closeout.

The reviewed contract is `docs/PEOPLE_MAP_CONTRACT.md` and requires, among other things:

- dedicated `map.read` / `map.write` sensitive capabilities;
- separate tenant-scoped approximate-location persistence;
- server-side coordinate validation/normalization to no more than two decimals;
- explicit manual source only;
- no automatic Contact-address geocoding, browser geolocation, IP/device geolocation or inferred location;
- GET `/api/people/map` minimum-data projection;
- PUT/DELETE `/api/people/:personId/map-location`;
- archived/non-publishable exclusion;
- no coordinate values copied into general audit/event metadata;
- Ant Design UI;
- equivalent semantic list/table;
- pt-PT/en/es;
- stale/double-submit ownership;
- unit/integration/API/client/UI/privacy/accessibility/browser-regression coverage;
- exact-head canonical `netlify/eutakes/deploy-preview` success before merge.

Implementation is being completed in a separate worker lane. This audit intentionally does not edit that worker's files.

## PX9.17 DOCX status

PX9.17 is **DEFERRED / NOT REQUIRED** for People technical closeout.

The detailed decision is recorded in `docs/PEOPLE_DOCX_EXPORT_DECISION.md`.

Reason: the repository consistently defines DOCX as conditional (“only if product need remains after user testing” / “where useful”), while approved CSV and PDF paths already cover the current export requirements. No open DOCX implementation issue establishes a contrary requirement.

Therefore PX9.17 must not be counted as unfinished technical work merely because an old checkbox remains unchecked.

## Source-of-truth drift found

Several planning/inventory statements are stale relative to integrated `main` and must be synchronized during the final post-Map closeout. This drift is documentation debt, not missing runtime functionality.

Examples found during this audit:

- `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` still leaves PX9.1/PX9.2 Transfers unchecked even though secure Transfers are integrated.
- The same master plan still leaves PX9.5 Record Cards and PX9.16 PDF unchecked despite reviewed integrations.
- `docs/AI_HANDOFF.md` and `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` still describe Map as lacking an approved location/privacy contract even though PR #389 is now on `main`.
- `docs/PRODUCT_EXPERIENCE_INVENTORY.md` is substantially older than the current People baseline and still describes multiple already-integrated PX7/PX9 slices as absent.

These shared files should be reconciled only after the final Map PR lands, so the status update can be performed once against the actual final People `main` SHA without creating parallel-edit conflicts.

## Open issue audit

Repository issue search on 2026-08-27 found no open DOCX/PX9.17 implementation issue.

Open issues containing “People” include historical/coordination/acceptance epics such as #318, #270, #268 and broad product epics. Their existence alone must not be interpreted as evidence of missing People runtime code; each issue's actual acceptance scope must be evaluated separately.

The final closeout must not automatically close broad project epics merely because the People reference module is technically complete.

## Human acceptance remains separate

The following are not safe to declare complete from CI or sanitized browser fixtures:

- real screen-reader acceptance;
- write-capable real-user production walkthrough using approved disposable/real test data;
- any physical-device evidence explicitly requiring an actual device.

These are acceptance activities, not missing People implementation. They remain tracked separately and must be reported truthfully as human/manual evidence gaps where applicable.

## Final technical closeout sequence

After the Map worker returns:

1. principal reviews the complete Map diff against `docs/PEOPLE_MAP_CONTRACT.md`;
2. correct any security/privacy/tenant/capability/API/UI/test defects;
3. require exact-head `quality` and `browser-regression` success;
4. require exact-head canonical `netlify/eutakes/deploy-preview` success;
5. merge Map only with exact expected head;
6. verify resulting `main` SHA;
7. synchronize `AI_HANDOFF.md`, `PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md`, `PRODUCT_EXPERIENCE_MASTER_PLAN.md` and `PRODUCT_EXPERIENCE_INVENTORY.md` against that final SHA;
8. record PX9.17 as non-blocking deferred rather than fabricating a DOCX implementation;
9. run final People technical audit for TODO/placeholders/regressions and zero unresolved P0/P1 technical defects;
10. keep real screen-reader/write-capable production acceptance explicitly separate.

## Current verdict

At this audit baseline, the remaining People technical path is:

**Finish and integrate PX9.10/PX9.11 Map → synchronize stale documentation → final gates/technical closeout.**

PX9.17 DOCX is not a technical blocker.