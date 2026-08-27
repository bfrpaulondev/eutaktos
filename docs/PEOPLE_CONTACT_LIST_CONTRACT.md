# People Contact List contract

This document defines the canonical PX9.12 bulk Contact List boundary. It reuses ordinary profile contacts already owned by People and does not create a second contact store.

## Authority and purpose

| Topic | Contract |
| --- | --- |
| Endpoint | `GET /api/people/contact-list` |
| Required server-derived capabilities | `people.read` **and** `reports.read` |
| Authority | Tenant, actor and capabilities come only from the verified server session. Browser-supplied authority is ignored. |
| Purpose | Searchable/filterable operational contact list and explicit user-triggered export. |
| Sensitive boundary | Emergency contacts are never returned. They remain under `emergency-contacts.read` and their dedicated resource. |

Bulk contact access is deliberately stricter than reading one person's ordinary contact. `reports.read` is required because this endpoint can expose ordinary contact information for many people in one request.

## Request

The endpoint accepts only non-PII selectors in the query string:

- `fields`: comma-separated allowlist from `phone,email,address,preferredLocale,groups,state`;
- `status`: `all`, `active` or `inactive`;
- `groupId`: optional opaque service-group identifier.

`displayName` is always returned and is not a selectable field. Person names, phone numbers, email addresses, postal addresses, labels and free-text search values are **not accepted in the URL**. Name search is a client-local operation after the authorized projection is loaded.

Default fields when `fields` is omitted: `phone,email`.

Unknown fields, repeated query values, invalid status values or invalid opaque identifiers fail with `400` rather than being silently widened.

## Response

```json
{
  "contractVersion": "people-contact-list-v1",
  "generatedAt": "2030-01-01T12:00:00.000Z",
  "fields": ["phone", "email"],
  "groups": [{ "id": "group-id", "name": "Group name" }],
  "people": [
    {
      "personId": "opaque-person-id",
      "displayName": "Person name",
      "phone": "+351 ...",
      "email": "name@example.org"
    }
  ]
}
```

Only requested optional fields are present. `personId` is an opaque UI identity and is never exported by default. Results are deterministic: people are sorted by display name and then person ID; groups are sorted by name and then ID.

## Privacy and export rules

- ordinary contact values must not be placed in route URLs, query strings, local/session storage, service-worker caches, logs, analytics, audit changed-field values or domain-event payload values;
- the endpoint is `no-store` through the standard API response wrapper;
- no emergency-contact values are included;
- no labels or eligibility/recommendation signals are included;
- export is an explicit user action and includes only currently selected Contact List fields;
- CSV cells are spreadsheet-formula hardened before download;
- browser filters/search remain ephemeral and are not persisted;
- 401 and 403 are distinct, fail-closed states.

## UI behavior

The PX9.12 UI must provide:

- configurable visible/exported fields;
- local name search plus status/group filters;
- responsive desktop/mobile presentation;
- explicit CSV export;
- loading, empty, error, 401, 403 and retry states;
- stale-request protection when selectors change;
- pt-PT, en and es copy;
- no success/fresh-data claim after a failed authoritative request.

Real-user production acceptance with real contact data remains a separate independent acceptance step and is not fabricated by automated fixtures.
