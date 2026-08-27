# Hourglass import dry-run and recovery boundary

## Status

PX9.8 provides the currently safe production-supported Hourglass reconciliation operation: an authenticated, server-authoritative **read-only dry-run** through `POST /api/import/hourglass/preview`.

PX9.9 is **not complete**. The repository contains application-layer migration/rollback primitives, but the production persistence adapter does not currently expose an atomic migration commit plus durable rollback-plan/log contract. A production Hourglass execute/rollback endpoint must not be added by composing independent per-person writes.

## What is safe today

- The browser parses only the selected supported source and retains the source payload in memory for the current inspector session.
- Only the proven Hourglass JSON source with stable `publishers[].id` can be sent to the server for comparison.
- The server re-validates the payload and resolves tenant, actor and capabilities from the authenticated session.
- Reconciliation matching is tenant-scoped external-ID-only. Display names are never identity keys.
- The preview returns `create`, `unchanged` and `conflict` outcomes without exposing internal person IDs, tenant IDs or Hourglass external IDs to the UI.
- The preview performs no People, eligibility, external-reference, migration-log, audit or outbox mutation.

This is the supported PX9 dry-run boundary until the write architecture below exists.

## Existing reusable application foundation

`packages/application/src/migration-workflow-service.ts` already models important invariants that a future Hourglass write adapter must preserve:

- prepare before execute;
- stale-confirmation rejection;
- explicit conflict/error rejection;
- rollback plans containing delete-new / restore-before semantics;
- tenant isolation and `people.write` capability enforcement;
- migration audit and domain events;
- explicit rollback state.

These application primitives are not evidence that production rollback exists. The production database adapter currently exposes entity-level mutation RPCs but no single durable transaction that atomically commits the imported People changes together with a migration log and rollback plan.

### Migration commit persistence foundation (2026-08-27)

The required durable transaction *primitive* now exists as an internal persistence contract: `eutaktos_apply_hourglass_migration_commit` (see `supabase/migrations/20260827110000_hourglass_migration_commit_atomic.sql`) applies all supported person changes together with the migration log, complete rollback plan, audit row and outbox event in one atomic transaction, records post-commit versions for future stale/concurrent-change protection during rollback, rejects cross-tenant payloads, duplicate change identities and concurrent entity modifications, and treats an identical retry under the same migration identity as `already-applied`.

This does **not** expose execute or rollback anywhere:

- no authenticated execute/rollback endpoint consumes it yet;
- the production unit-of-work binding between `MigrationWorkflowService` and this RPC still has to be implemented and reviewed;
- rollback application using the persisted plan remains intentionally unimplemented until its own reviewed stale-protection contract exists;
- the canonical import surface therefore remains the read-only dry-run preview documented above.

## Required production contract before PX9.9 can be completed

A future implementation must provide one server-owned transaction boundary that:

1. resolves tenant, actor and capabilities from the verified session;
2. re-runs validation and reconciliation against fresh authoritative state;
3. rejects stale confirmation and unresolved conflicts before mutation;
4. atomically applies all supported changes or applies none;
5. persists a migration identifier, operation log and complete rollback plan in the same durable transaction;
6. records minimum-necessary audit/domain-event metadata without imported PII values;
7. supports idempotent retry after ambiguous network outcomes;
8. supports tenant-isolated rollback using the persisted plan, with stale/concurrent-change protection;
9. verifies the resulting authoritative state after execute and rollback;
10. never places source payload, contact values, names or other imported PII in URLs, browser storage, analytics, logs or service-worker caches.

If the underlying data model cannot guarantee an atomic execute/rollback contract, the product must keep the import read-only rather than display a misleading Apply or Rollback action.

## Acceptance boundary

PX9.9 remains unchecked until the production transaction/persistence contract above exists, automated failure/retry/tenant/privacy tests pass, and the write-capable real-user production walkthrough is performed by the independent acceptance agent. The existing preview must not be described as a completed rollback-capable import.