# People Record Cards / Reports contract

This document defines the canonical PX9.5 report boundary for factual completed-assignment records.

## Authority and privacy

- Endpoint: `GET /api/people/record-cards`.
- Required server-derived capabilities: `people.read`, `schedule.read`, `reports.read`.
- Tenant, actor and capabilities come only from the verified server session.
- The browser supplies only period selectors. It cannot supply people, assignment history, tenant or authority facts.
- The response never includes ordinary contacts, emergency contacts, labels, eligibility configuration, availability, archive reasons, actor IDs or recommendation evidence.
- The endpoint is `no-store` through the standard API response wrapper.

## Period semantics

The endpoint accepts exactly one of these selector forms:

- `year=YYYY`: the inclusive civil period `YYYY-01-01` through `YYYY-12-31`;
- `from=YYYY-MM-DD&to=YYYY-MM-DD`: inclusive civil meeting-date range.

Rules:

- `from` and `to` must be supplied together;
- `from` must not be after `to`;
- maximum custom range is 366 days;
- repeated, unknown or malformed query values fail with `400`;
- period filtering uses the meeting's stored civil `date`, not a browser timezone or reconstructed UTC date.

## Report shape

```json
{
  "contractVersion": "people-record-cards-v1",
  "generatedAt": "2030-01-01T12:00:00.000Z",
  "period": { "from": "2030-01-01", "to": "2030-12-31" },
  "cards": [
    {
      "personId": "opaque-person-id",
      "displayName": "Person name",
      "records": [
        { "meetingDate": "2030-03-12", "partType": "reading" }
      ]
    }
  ]
}
```

Only completed assignment history is reportable. Student, assistant and non-student completed assignments are projected through the existing authoritative scheduling history boundary. Cancelled or merely assigned work is excluded.

Cards are sorted by display name then person ID. Records are sorted by meeting date, then part type, then stable history identity before that internal identity is removed from the public DTO.

## UI behavior

The People tool must provide:

- year selection and an explicit custom-period mode;
- preview before any print/export action;
- loading, empty, error, 401, 403 and retry states;
- stale-request ownership when selectors change;
- pt-PT, en and es copy;
- no browser persistence of report contents or filters;
- an explicit print action for the current authorized preview only.

Printing is a user-controlled browser action and does not claim direct PX9.16 binary PDF export. PX9.16 remains a separate export task unless a direct PDF artifact contract is implemented and tested.