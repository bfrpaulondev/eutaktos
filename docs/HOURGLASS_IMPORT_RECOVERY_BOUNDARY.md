# Hourglass import dry-run and recovery boundary

## Status

PX9.8 provides the currently safe production-supported Hourglass reconciliation operation: an authenticated, server-authoritative **read-only dry-run** through `POST /api/import/hourglass/preview`.

PX9.9 is **not complete**. Durable atomic apply and a deliberately create-only rollback primitive now exist internally, but no authenticated execute/rollback HTTP surface is exposed. A production Hourglass execute/rollback flow must not be added by composing independent per-person writes or by binding the older generic migration workflow without reconciling it with the current Hourglass-specific explicit-eligibility contract.

## What is safe today

- The browser parses only the selected supported source and retains the source payload in memory for the current inspector session.
- Only the proven Hourglass JSON source with stable `publishers[].id` can be sent to the server for comparison.
- The server re-validates the payload and resolves tenant, actor and capabilities from the authenticated session.
- Reconciliation matching is tenant-scoped external-ID-only. Display names are never identity keys.
- The preview returns `create`, `unchanged` and `conflict` outcomes without exposing internal person IDs, tenant IDs or Hourglass external IDs to the UI.
- The preview performs no People, eligibility, external-reference, migration-log, audit or outbox mutation.

This remains the supported user-facing PX9 boundary until the server execution composition below is completed and independently accepted.

## Existing reusable application foundation

`packages/application/src/migration-workflow-service.ts` models useful invariants that future Hourglass write composition should preserve:

- prepare before execute;
- stale-confirmation rejection;
- explicit conflict/error rejection;
- tenant isolation and `people.write` capability enforcement;
- migration audit and domain events;
- explicit rollback state.

It is **not** the authoritative Hourglass write contract by itself. Its generic row/update model predates the current Hourglass projection, which includes explicit eligibility evidence and currently treats differences to existing People as conflicts rather than silent updates. Do not bind it blindly to production persistence.

### Atomic migration commit foundation (2026-08-27)

`eutaktos_apply_hourglass_migration_commit` provides the durable atomic apply primitive. It applies all supported person changes together with the migration log, complete rollback plan, audit row and outbox event in one database transaction, records post-commit versions, rejects cross-tenant payloads, duplicate change identities and concurrent entity modifications, and retains a complete exact-envelope commit fingerprint for integrity checks.

Migration `20260827114500_hourglass_migration_apply_replay_lock.sql` serializes apply attempts for the same tenant + migration identity with a transaction-scoped advisory lock. This closes the concurrent-retry race where two identical requests could previously pass the pre-insert replay lookup at the same time. The internal unlocked function is not executable by `service_role`; callers use the serialized wrapper.

Migration `20260827121500_hourglass_migration_intent_replay.sql` adds a second, logical replay identity. The future authenticated execute boundary must compute a lowercase SHA-256 `intentFingerprint` **server-side** from the freshly revalidated mutation intent and must reuse the same migration identity for the same client mutation identity. The persisted logical fingerprint allows an ambiguous retry to return `already-applied` even if rebuilt audit/event identifiers or timestamps differ. Reusing the migration identity with a different logical intent fails closed. The browser never supplies an authoritative fingerprint.

The exact commit fingerprint and logical intent fingerprint have different jobs:

- `commitFingerprint` proves the exact persisted envelope used for the original atomic write;
- `intentFingerprint` proves that a later retry represents the same server-validated logical mutation.

### Create-only rollback foundation (2026-08-27)

`eutaktos_rollback_hourglass_create_migration` provides a deliberately narrow atomic rollback primitive for the shape the authoritative Hourglass preview can currently accept safely: created People only. It:

- locks the persisted migration and every created Person before deletion;
- requires exact post-commit entity versions;
- aborts the whole rollback if any created Person changed or disappeared;
- marks the migration `rolled-back` and persists audit/outbox evidence atomically;
- treats an exact retry as `already-rolled-back`;
- rejects update/restore migration shapes instead of pretending the older partial restore snapshot is sufficient for explicit eligibility or richer People state.

These persistence primitives still do **not** expose execute or rollback to a user:

- no authenticated execute endpoint consumes the apply primitive;
- no authenticated rollback endpoint consumes the create-only rollback primitive;
- no browser Apply/Rollback action is authorized yet;
- the next safe implementation is an Hourglass-specific server execution composition built from fresh authoritative inspection/preview evidence, not a blind generic `MigrationWorkflowService` binding;
- the canonical user-facing import surface therefore remains the read-only dry-run preview.

## Required production contract before PX9.9 can be completed

A future implementation must provide one server-owned execution boundary that:

1. resolves tenant, actor and capabilities from the verified session;
2. re-runs Hourglass validation and reconciliation against fresh authoritative People + explicit eligibility state;
3. rejects stale confirmation and unresolved conflicts before mutation;
4. maps only the currently approved Hourglass create shape into complete canonical Person data and explicit eligibility data;
5. atomically applies all supported changes or applies none;
6. persists a migration identifier, operation log and complete rollback evidence in the same durable transaction;
7. records minimum-necessary audit/domain-event metadata without imported PII values;
8. supports idempotent retry after ambiguous network outcomes, including simultaneous retries for the same migration identity, by using a stable client mutation identity plus a server-computed logical intent fingerprint;
9. exposes rollback only for migration shapes whose persisted rollback evidence is complete enough to restore safely;
10. verifies the resulting authoritative state after execute and rollback;
11. never places source payload, contact values, names or other imported PII in URLs, browser storage, analytics, logs or service-worker caches.

If the underlying data model cannot guarantee the relevant atomic execute/rollback contract for a migration shape, the product must keep that shape read-only rather than display a misleading Apply or Rollback action.

## Acceptance boundary

PX9.9 remains unchecked until the authenticated Hourglass-specific execution composition exists, automated failure/retry/concurrency/tenant/privacy tests pass, and the write-capable real-user production walkthrough is performed by the independent acceptance agent. Internal persistence primitives or a green preview alone are not evidence of a completed rollback-capable import workflow.
