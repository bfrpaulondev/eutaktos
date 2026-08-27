# Hourglass import dry-run and recovery boundary

## Status

PX9.7–PX9.9 now have a technically integrated, server-authoritative Hourglass flow on `main`:

`inspect locally → preview → prepare → explicit confirm → atomic execute → optional create-only rollback`

The earlier read-only boundary is superseded by PR #379 (authenticated server-owned prepare/execute/rollback handshake) and PR #380 (confirmed Ant Design browser flow). This document distinguishes that technical completion from the destructive real-user production acceptance that is still intentionally pending.

## Supported product boundary

- The browser parses only the selected supported source and retains the source payload in memory for the current inspector session.
- Only the proven Hourglass JSON source with stable `publishers[].id` can proceed to server reconciliation and writes.
- Contact-list CSV and privileges CSV remain inspection-only because no stable publisher identity has been proven for those sources.
- Preview and prepare both re-validate the bounded source server-side under authenticated tenant/capability context.
- Reconciliation matching is tenant-scoped external-ID-only. Display names are never identity keys.
- The server returns create/unchanged/conflict evidence without exposing internal Person IDs, tenant IDs or Hourglass external IDs to the browser.
- Any conflict blocks execution; the product does not silently update an existing Person.
- The browser never supplies tenant, actor, capabilities, attempt timestamps or migration authority.

## Atomic migration commit foundation

`eutaktos_apply_hourglass_migration_commit` is the durable atomic apply primitive. It applies all supported Person changes together with the migration log, complete rollback plan, audit row and outbox event in one database transaction, records post-commit versions, rejects cross-tenant payloads, duplicate change identities and concurrent entity modifications, and uses a complete commit fingerprint for replay identity.

Migration `20260827114500_hourglass_migration_apply_replay_lock.sql` serializes apply attempts for the same tenant + migration identity with a transaction-scoped advisory lock before the fingerprint replay guard executes. The internal unlocked function is not executable by `service_role`; callers use the serialized wrapper.

## Create-only rollback foundation

`eutaktos_rollback_hourglass_create_migration` is deliberately narrow because the currently approved Hourglass write shape creates People only. It:

- locks the persisted migration and every created Person before deletion;
- requires exact post-commit entity versions;
- aborts the whole rollback if any created Person changed or disappeared;
- marks the migration `rolled-back` and persists audit/outbox evidence atomically;
- treats an exact retry as `already-rolled-back`;
- rejects update/restore migration shapes instead of pretending an incomplete restore snapshot is sufficient.

## Hourglass-specific execution composition

`api/import/hourglass/_execution.ts` rebuilds the canonical preview from fresh tenant-scoped People immediately before commit and preserves these invariants:

- requires `people.read`, `people.write`, `eligibility.read` and `eligibility.write` before authoritative execution state is read or mutated;
- SHA-256 confirmation digest is stale-state evidence, never authority;
- preserves `create` / `unchanged` / `conflict` semantics;
- imports newly created People as inactive with only stable Hourglass publisher external identity and explicitly demonstrated Hourglass privileges as eligibility decisions;
- imports no ordinary Contact or emergency-contact data;
- exact ambiguous retries reproduce the same server-owned migration identity/fingerprint and recover the prior result safely;
- a rolled-back execution identity cannot be reused as if it were an unapplied migration;
- authoritative Person state is re-read and verified after apply.

## Authenticated prepare → confirm → execute handshake

PR #379 / main SHA `bc53c5eec2923ce813a0ee026039c3822f7e0d5c` completed the HTTP authority boundary:

- `POST /api/import/hourglass/prepare` validates same-origin mutation, derives principal/capabilities server-side, persists a server-owned execution attempt and returns its opaque `executionId`, expiry, confirmation digest, exact reviewed preview and counts;
- `POST /api/import/hourglass/execute` requires the persisted execution identity plus the exact prepared confirmation digest and source payload, reloads the server-owned attempt, rebuilds fresh authoritative state and invokes the atomic execution composition;
- `POST /api/import/hourglass/rollback` accepts only the migration identity returned by a completed import and invokes the authorized create-only rollback composition;
- request parsers reject extra/authority-bearing fields and bounded request limits remain aligned with the 5 MB import contract;
- same-origin mutation protection, tenant/capability checks, replay/idempotency and late-retry recovery are covered by handler/application/database tests.

The server-generated attempt timestamp and authority remain private server facts. The browser cannot choose or reconstruct them.

## Browser confirmation and retry ownership

PR #380 / main SHA `e7ba41d8aca0040392fff87788190e4a878c5e45` completed the user-facing Ant Design flow:

- the user first reviews a read-only reconciliation preview;
- Prepare obtains the exact server-bound preview and confirmation digest;
- execution requires a separate explicit confirmation dialog;
- conflict previews cannot execute;
- ambiguous execution failures can be retried against the same prepared attempt rather than generating a duplicate migration;
- successful imports expose only minimum-necessary outcome/counts and the opaque migration identity needed for rollback;
- rollback has a separate destructive confirmation;
- stale response ownership, request cancellation and double-submit guards prevent old or repeated async work from taking control;
- pt-PT/en/es copy is present;
- source payload and execution state are not persisted to browser storage or URLs.

## Production acceptance boundary

PX9.9 is technically complete. It is **not** a claim that a destructive real-user production import/rollback has been executed.

The independent production scenario must use an approved disposable Hourglass fixture and is recorded in `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md`. CI, sanitized browser fixtures and Netlify preview evidence prove technical readiness only; they do not replace that production write acceptance.

## Non-goals / deferred expansion

- No automatic import from Contact-list CSV or privilege-matrix CSV without a proven stable identity contract.
- No silent update of existing People on reconciliation conflicts.
- No rollback support for richer update/restore shapes until the persistence snapshot can prove complete restoration of all affected state.
- No Contact PII import through this Hourglass path.
