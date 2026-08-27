# People Map contract

This document defines the canonical PX9.10/PX9.11 privacy and authority boundary for showing People on a map.

## Product decision

People Map is an explicit, approximate-location feature. It must not geocode ordinary Contact postal addresses automatically and must not expose precise home coordinates.

Location is a separate server-owned Person attribute with explicit opt-in. A Person may have no map location even when ordinary Contact contains a postal address.

A user with the explicit Map write boundary may perform a **manual place/address search as an editing aid**. This search is never populated from ordinary Contact, never runs automatically, is not autocomplete-on-keystroke, and does not change the stored-location model. The user must still confirm or adjust the location on the map before saving.

## Authority

- Read endpoint requires server-derived `people.read` and `map.read`.
- Write/remove location endpoints require server-derived `people.write` and `map.write`.
- Explicit place search also requires server-derived `people.write` and `map.write` because it exists only inside the location-editing workflow.
- Tenant, actor and capabilities come only from the verified server session.
- Browser input may identify the Person and submit an explicit approximate location value; it cannot supply tenant, actor, capabilities, ownership or authorization facts.
- Place search sends only the explicit search text to the Eutaktos server. It never sends Person ID/name, tenant, actor, Contact data or capabilities to the geocoding provider.
- Cross-tenant reads/writes are rejected before projection or persistence.
- Map endpoints use `no-store` through the standard API response wrapper.

## Least-privilege capabilities

Add two dedicated capabilities:

- `map.read`: may read the minimum-data map projection;
- `map.write`: may set or remove a Person's explicit map location.

`tenant.manage`, `people.read`, `people.write`, `reports.read` or ordinary Contact access do not imply map access.

`map.read` and `map.write` are privacy-sensitive capabilities and must be included in the sensitive-capability boundary used by access management.

## Location model

Canonical stored location shape:

```json
{
  "latitude": 38.52,
  "longitude": -8.89,
  "precision": "approximate",
  "source": "manual",
  "updatedAt": "2030-01-01T12:00:00.000Z"
}
```

Rules:

- `source` is always `manual` in v1;
- browser geolocation, IP geolocation and **automatic** address geocoding are out of scope;
- explicit user-triggered place/address search is allowed only as an ephemeral editing aid and never changes `source: manual`;
- latitude must be within `[-90, 90]` and longitude within `[-180, 180]`;
- coordinates are normalized server-side to two decimal places before persistence and response;
- two decimal places are the maximum persisted precision in v1, intentionally limiting location to an approximate area rather than a precise residence;
- search-result precision may exist transiently in memory only so the user can position the map; it is never persisted before the two-decimal normalization boundary;
- no raw pre-normalization coordinate is persisted in domain events, audit payloads or logs;
- location is optional and independently removable without changing ordinary Contact;
- setting/removing a location does not modify the Person's postal address;
- deleting or archiving ordinary Contact does not implicitly create, update or delete map location;
- archived/non-publishable People are excluded from the map projection.

## Read projection

Endpoint:

`GET /api/people/map`

Response contract:

```json
{
  "contractVersion": "people-map-v1",
  "points": [
    {
      "personId": "opaque-person-id",
      "displayName": "Person name",
      "latitude": 38.52,
      "longitude": -8.89
    }
  ]
}
```

The projection includes only:

- opaque Person ID;
- display name;
- normalized approximate coordinates.

It excludes ordinary Contact values, postal address, phone, email, emergency contacts, eligibility, availability, labels, responsibilities, assignment history, external IDs, archive reasons, source metadata, actor IDs and exact update timestamps.

Only active, publishable People with an explicit map location are returned.

Ordering is deterministic by display name then Person ID.

## Explicit place search

Endpoint:

`POST /api/people/map`

Body:

```json
{
  "query": "Rua do Comércio, Setúbal"
}
```

Rules:

- the browser must send the query in the POST body, never in the Eutaktos URL/query string;
- the request is allowed only after an explicit user action such as pressing `Pesquisar`;
- no autocomplete request is sent for every keystroke;
- the server requires same-origin request evidence plus `people.write + map.write`;
- the server sends only the explicit query text to the configured geocoder;
- Person name/ID, tenant, actor, Contact values and capabilities are never sent to the geocoder;
- Eutaktos does not persist the query in Person data, audit, outbox, logs, analytics, URL, localStorage or service-worker cache;
- search results remain ephemeral UI state and are not a Person resource;
- provider results are projected to label + coordinate candidates only; provider-specific identifiers/metadata are stripped;
- the current provider can be replaced through server configuration without changing the browser contract;
- provider traffic is bounded/cached where practical and must not be used for bulk/background geocoding.

Response shape:

```json
{
  "contractVersion": "people-map-search-v1",
  "provider": "photon-osm",
  "results": [
    {
      "id": "place-1",
      "label": "Rua do Comércio, Setúbal, Portugal",
      "latitude": 38.5212,
      "longitude": -8.8926
    }
  ]
}
```

The result coordinate is only a map-positioning aid. Saving still uses the canonical mutation contract and server-side two-decimal normalization.

## Mutation contract

Endpoints:

- `PUT /api/people/:personId/map-location`
- `DELETE /api/people/:personId/map-location`

`PUT` body:

```json
{
  "latitude": 38.520123,
  "longitude": -8.890456
}
```

The server validates bounds, normalizes to two decimal places and persists only the normalized value.

Mutation responses return only the authoritative normalized location state needed by the UI. They must not return ordinary Contact or other private Person data.

Exact retries with the same normalized coordinates are idempotent. Removing an absent location is also idempotent.

## Audit and domain events

Location writes/removals must emit auditable evidence without duplicating coordinates into general-purpose audit/event payloads.

Safe evidence contains:

- tenant-scoped Person identity;
- operation (`set` or `remove`);
- mutation/result identity or timestamp according to existing audit conventions;
- actor identity only where the existing audit contract already requires it.

Coordinates themselves are not copied into audit logs or domain-event metadata. Place-search text/results generate no Person audit/domain event because search is an ephemeral editing aid, not persisted domain state.

## UI behavior

The People tool must provide:

- an explicit Map entry point visible only when the session has `map.read`;
- loading, empty, error, 401, 403 and retry states;
- accessible non-map fallback list containing the same names and approximate locations represented textually;
- keyboard-accessible point selection and equivalent list selection;
- no browser persistence of coordinates or search text;
- no third-party map provider receiving Person names, Person IDs or Contact data;
- pt-PT, en and es copy;
- stale-request ownership when switching filters/views/searches;
- an explicit edit/remove flow only when `map.write` is present;
- clear copy that location is approximate and manually confirmed;
- search-first editing UX: explicit place/address search, select result, click/drag the map marker, then save;
- direct latitude/longitude inputs may remain as an advanced fallback, not the primary workflow.

If a map tile provider is used, it receives only ordinary tile requests required to render the base map. Person overlays are rendered locally from the authorized Eutaktos projection and are never embedded into provider query strings or telemetry.

## Accessibility

The graphical map is an enhancement, not the sole representation. The same authorized projection must be available as a semantic list/table so screen-reader and keyboard users can access every mapped Person without interacting with map gestures.

The editor must not require map gestures: search results and advanced coordinate inputs provide semantic alternatives to click/drag interaction.

Automated accessibility gates cover roles, labels, focus order, keyboard operation, zoom/reflow and equivalent-list presence. Real screen-reader acceptance remains a separate human acceptance step.

## Explicitly prohibited

PX9.10/PX9.11 must not:

- automatically geocode ordinary Contact addresses or preload the search box from Contact;
- run background/bulk geocoding or autocomplete requests on every keystroke;
- persist place-search text or provider-specific result metadata against a Person;
- persist coordinates more precise than two decimal places;
- use browser/IP/device geolocation to locate a Person;
- infer map location from congregation/group membership or other profile facts;
- expose coordinates through Directory, Contact List, Transfers, Record Cards or generic People DTOs;
- make map access implicit in tenant administration;
- send Person identity, tenant/actor authority data or Contact PII to a third-party map/geocoding provider;
- log search text or coordinates in analytics, audit text or error telemetry.

## Implementation acceptance

PX9.10/PX9.11 are technically complete only when all of the following are proven:

- dedicated location persistence with tenant isolation;
- `map.read` / `map.write` capability enforcement server-side;
- normalization/validation and idempotent mutations;
- minimum-data read projection;
- archived/non-publishable exclusion;
- no Contact-address coupling or automatic geocoding;
- explicit search is POST-body only, same-origin, capability gated, non-persistent and strips provider metadata;
- API routing and client contract tests;
- Ant Design People UI with accessible equivalent list;
- search → select → map adjust → save workflow plus advanced non-map fallback;
- pt-PT/en/es;
- stale/double-submit protection where applicable;
- privacy tests proving excluded fields never enter the map DTO/search provider request;
- CI, browser regression and canonical `netlify/eutakes` preview pass on the exact PR head.
