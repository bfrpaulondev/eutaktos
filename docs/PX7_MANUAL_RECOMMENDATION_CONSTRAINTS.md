# PX7.8 — Manual recommendation constraints

This is the canonical v1 contract for explicit manual recommendation constraints. It closes PX7.8 without introducing browser-only state, subjective ranking preferences or inferred personal attributes.

## V1 product decision

V1 supports one explicit operational constraint only: **exclude this Person from recommendations for this assignment type**. It does not implement positive preference/boosting. A positive preference would alter ranking for subjective reasons and requires a separate reviewed product decision.

The exclusion is advisory workflow configuration: it prevents the Person from appearing in the ranked recommendation candidates for the matching explicit assignment type. It does not change eligibility, availability, responsibilities or the underlying Person record.

## Authority and persistence

- Persistent entity type: `recommendation-manual-constraint`.
- Identity is deterministically derived server-side from `tenantId + personId + assignmentTypeId`.
- Stored fields are limited to opaque IDs, `kind: "exclude"` and a server timestamp. No free-text reason, contact value or inferred attribute is stored.
- Tenant, actor, capabilities, assignment type and timestamps are server authoritative.
- The browser sends only `meetingId`, `slotId`, `personId` and explicit intent `exclude | allow`.
- The server derives `assignmentTypeId` from the persisted tenant meeting + slot and verifies the Person exists in the same tenant.
- Exact retries are idempotent: excluding an already-excluded Person or allowing an already-allowed Person performs no second write.

## Capability boundary

Recommendation reads retain the existing requirements: `people.read`, `eligibility.read`, `availability.read` and `schedule.read`.

Manual exclusion mutation additionally requires `schedule.write`. The response advertises `canManageManualConstraints` only from the server-derived principal so the UI can hide mutation controls for read-only users.

## Recommendation semantics

The existing deterministic recommendation engine remains the source of eligibility, availability, conflict, workload and history evidence. Persisted manual constraints are applied after those factual hard constraints and before public rank is returned.

For the exact tenant + assignment type:

- matching excluded candidates move from `candidates` to `excluded`;
- remaining candidates are re-ranked sequentially in their existing deterministic order;
- the excluded candidate carries structured `manualConstraintCodes: ["MANUAL_EXCLUSION"]`;
- factual reason/warning evidence is preserved rather than rewritten as a false eligibility or availability failure;
- constraints from another tenant or assignment type have no effect.

## Audit/privacy boundary

Create/remove writes use the generic expected-version entity persistence path with `recommendation-constraint` audit resource and `RecommendationConstraintChanged` domain event. Audit/events contain resource identity and action metadata only, not names, contact data or a free-text exclusion reason.

The Person display name is joined only into the already-authorized recommendation response. No constraint or Person PII is placed in URL parameters beyond the existing opaque recommendation target IDs, browser storage, service-worker cache, logs or analytics.

## UI behavior

The Ant Design recommendation picker exposes exclusion/removal controls only when the server says the principal may manage them. Both actions require explicit confirmation, disable concurrent mutation, refetch authoritative recommendation evidence after success and ignore stale mutation responses.

The human user remains final decision-maker. Manual exclusion never creates an assignment and never changes spiritual/personal suitability.