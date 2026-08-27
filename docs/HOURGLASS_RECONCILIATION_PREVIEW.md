# Hourglass reconciliation preview

PX9.8 adds a **read-only** comparison step for the proven Hourglass JSON export. It does not import or mutate data.

## Supported source

Only the observed JSON shape containing `publishers`, `fsGroups` and `privileges` may enter server reconciliation. `publishers[].id` is the only proven stable person reference and is normalized as `hourglass:publisher:<id>`.

Contact-list CSV and privilege-matrix CSV remain local inspection formats. They do not contain the proven stable publisher ID and therefore are never submitted for automatic reconciliation or matched by name.

## Authority and matching

`POST /api/import/hourglass/preview` requires an authenticated server-derived principal with `people.read` and `eligibility.read`. Tenant, actor and capabilities are never accepted from the browser payload.

The server loads People only inside the principal tenant and matches an Hourglass publisher only when an existing person already has the exact external reference in `CongregationPerson.externalIds`. Identical names do not establish identity, and an external reference owned by another tenant is not visible to or reusable by the current tenant.

## Response minimization

The browser receives only what it needs to review the comparison:

- display name from the submitted export;
- action: `create`, `unchanged` or `conflict`;
- whether a stable external link already exists;
- structured conflict reason codes;
- explicit Hourglass assignment-type identifiers needed to explain eligibility differences;
- aggregate counts and the sanitized parser report.

The response does **not** expose internal person IDs, tenant IDs or Hourglass publisher external IDs.

## Privacy and lifecycle

The JSON remains in browser memory after local inspection until the user explicitly chooses **Compare with Eutaktos**. The preview request uses a same-origin JSON body; source data is never placed in URLs, router state, local/session storage, service-worker caches, analytics or audit values.

New file/source selection, dialog close or a newer comparison aborts/invalidates the previous preview ownership. CSV sources never call the preview endpoint.

## No-write boundary

PX9.8 does not create people, link external references, change names, alter eligibility or write migration logs. Conflicts are evidence for a later human-controlled migration step. PX9.9 remains responsible for any approved dry-run/execution/rollback architecture and must preserve explicit confirmation, idempotency, audit and recovery semantics.