# Hourglass import dry-run and recovery boundary

## Status

PX9.8 provides the currently safe production-supported Hourglass reconciliation operation: an authenticated, server-authoritative **read-only dry-run** through `POST /api/import/hourglass/preview`.

PX9.9 is **not complete**. Durable atomic apply, replay serialization, a deliberately create-only rollback primitive, and an Hourglass-specific internal server execution composition now exist. No authenticated execute/rollback HTTP surface or browser Apply/Rollback action is exposed yet.

## What is safe today

- The browser parses only the selected supported source and retains the source payload in memory for the current inspector session.
- Only the proven Hourglass JSON source with stable `publishers[].id` can be sent to the server for comparison.
- The server re-validates the payload and resolves tenant, actor and capabilities from the authenticated session for the existing preview route.
- Reconciliation matching is tenant-scoped external-ID-only. Display names are never identity keys.
- The preview returns `create`, `unchanged` and `conflict` outcomes without exposing internal person IDs, tenant IDs or Hourglass external IDs to the UI.
- The preview performs no People, eligibility, external-reference, migration-log, audit or outbox mutation.

This remains the supported user-facing PX9 boundary until the authenticated execute handshake and rollback surface are separately reviewed and accepted.

## Existing reusable application foundation

`packages/application/src/migration-workflow-service.ts` models useful invariants that Hourglass write composition must preserve:

- prepare before execute;
- stale-confirmation rejection;
- explicit conflict/error rejection;
- tenant isolation and `people.write` capability enforcement;
- migration audit and domain events;
- explicit rollback state.

It is **not** the authoritative Hourglass write contract by itself. Its generic row/update model predates the current Hourglass projection, which includes explicit eligibility evidence and treats differences to existing People as conflicts rather than silent updates. Do not bind it blindly to production persistence.

### Atomic migration commit foundation (2026-08-27)

`eutaktos_apply_hourglass_migration_commit` provides the durable atomic apply primitive. It applies all supported person changes together with the migration log, complete rollback plan, audit row and outbox event in one database transaction, records post-commit versions, rejects cross-tenant payloads, duplicate change identities and concurrent entity modifications, and uses a complete commit fingerprint for replay identity.

Migration `20260827114500_hourglass_migration_apply_replay_lock.sql` additionally serializes apply attempts for the same tenant + migration identity with a transaction-scoped advisory lock before the existing fingerprint replay guard executes. This closes the concurrent-retry race where two identical requests could previously pass the pre-insert replay lookup at the same time. The internal unlocked function is not executable by `service_role`; callers must use the serialized wrapper.

### Create-only rollback foundation (2026-08-27)

`eutaktos_rollback_hourglass_create_migration` provides a deliberately narrow atomic rollback primitive for the shape the authoritative Hourglass preview can currently accept safely: created People only. It:

- locks the persisted migration and every created Person before deletion;
- requires exact post-commit entity versions;
- aborts the whole rollback if any created Person changed or disappeared;
- marks the migration `rolled-back` and persists audit/outbox evidence atomically;
- treats an exact retry as `already-rolled-back`;
- rejects update/restore migration shapes instead of pretending the older partial restore snapshot is sufficient for explicit eligibility or richer People state.

### Hourglass-specific internal execution composition (2026-08-27)

PR #374 / integrated main `9637b23b1ea7b6533cedae73ad48ff83f8dcea1e` adds the internal `prepareHourglassExecution` and `executeHourglassImport` composition in `api/import/hourglass/_execution.ts`.

The composition:

- requires `people.read`, `people.write`, `eligibility.read` and `eligibility.write` before reading or mutating authoritative state;
- rebuilds the canonical Hourglass preview from fresh tenant-scoped People immediately before commit;
- uses a SHA-256 confirmation digest only as stale-state evidence, never as authority;
- preserves `create` / `unchanged` / `conflict` semantics and rejects unresolved conflicts instead of silently updating existing People;
- maps newly imported People as inactive, with only the stable Hourglass publisher external id and explicitly demonstrated Hourglass privileges as eligibility decisions;
- imports no ordinary contact or emergency-contact data;
- derives stable migration/person/operation/audit/event identities from a server execution attempt so an ambiguous exact retry can reproduce the same atomic commit fingerprint;
- reuses persisted create evidence only to reconstruct the pre-commit state for an exact replay, while the serialized database RPC remains the final idempotency authority;
- rejects reuse of an execution identity after rollback;
- re-reads authoritative People after `applied` or `already-applied` and verifies the expected created state.

The internal execution attempt contains a generated identity and initiation timestamp. It is **not** yet an approved browser contract. A future HTTP route must not trust a browser-supplied attempt timestamp or authority fields; the prepare→confirm→execute handshake must keep that server-generated attempt trustworthy across requests.

These internal primitives still do **not** expose execute or rollback to a user:

- no authenticated execute route calls the internal execution composition;
- no authenticated rollback endpoint consumes the create-only rollback primitive;
- no browser Apply/Rollback action is authorized yet;
- the canonical user-facing import surface therefore remains the read-only dry-run preview.

## Required remaining production contract before PX9.9 can be completed

Before exposing execute, the authenticated handshake must:

1. resolve tenant, actor and all required capabilities from the verified session;
2. re-inspect the submitted Hourglass payload server-side under the same bounded import limits;
3. create or recover a server-owned execution attempt without trusting browser timestamps, tenant, actor or capability claims;
4. bind the human-confirmed preview digest to that attempt so a changed authoritative preview fails stale before mutation;
5. invoke the existing Hourglass-specific create-only execution composition rather than independent per-person writes;
6. preserve same-origin mutation protection and exact retry/idempotency behavior after ambiguous network outcomes;
7. return only minimum-necessary execution status and migration identity, without leaking imported PII into URLs, logs, analytics, browser storage or service-worker caches;
8. expose rollback separately only for the persisted create-only migration shape currently proven safe;
9. verify resulting authoritative state after execute and rollback;
10. keep real-user destructive production acceptance separate and explicitly documented.

If the HTTP handshake cannot preserve the server-owned execution identity and atomic/recovery guarantees, the product must keep the import read-only rather than display a misleading Apply or Rollback action.

## Acceptance boundary

PX9.9 remains unchecked until the authenticated prepare→confirm→execute boundary and the authorized create-only rollback boundary are exposed and pass automated failure/retry/concurrency/tenant/privacy tests. The write-capable real-user production walkthrough remains a separate independent acceptance task and must not be inferred from CI or preview deployments.
