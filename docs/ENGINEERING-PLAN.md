# Engineering Plan

## Development model

- trunk-based development with short-lived branches;
- pull request required for production code;
- protected main branch;
- required CI checks;
- no direct production changes outside emergency procedure;
- conventional commits / semantic release decision before first release;
- Architecture Decision Records for material technical choices;
- threat-model update required for new data flows or third-party integrations.

## Suggested monorepo

```text
apps/web-pwa
apps/api
apps/worker
packages/domain
packages/scheduler
packages/permissions
packages/ai
packages/import-export
packages/contracts
packages/i18n
packages/ui
packages/observability
infra/
docs/
```

## Candidate technology direction

- TypeScript end-to-end;
- one React-based, installable Progressive Web App as the initial and canonical client;
- mobile-first responsive design with progressive enhancement for tablet/desktop;
- dedicated native clients deferred until a proven platform requirement justifies them;
- Node.js TypeScript API;
- PostgreSQL as canonical relational datastore;
- object storage for documents with per-object authorization;
- queue/worker for notifications, imports and exports;
- OpenAPI or equivalent machine-readable API contract;
- infrastructure as code;
- KMS-backed secrets and encryption keys.

Exact products/providers are intentionally not locked until the Phase 0 privacy, residency, cost and threat-model review.

## Definition of Done for every feature

A feature is complete only when:
- acceptance criteria pass;
- authorization rules are explicit;
- unit/integration/E2E coverage appropriate to risk exists;
- error states are designed;
- audit events are defined where needed;
- WCAG 2.2 AA impact is checked and critical flows include appropriate accessibility tests;
- keyboard, focus, screen-reader, reflow and touch behavior are defined for UI work;
- responsive behavior is verified across target form factors;
- localization is supported, including long-text resilience;
- theme/personalization tokens preserve accessibility requirements;
- PWA caching/offline/update impact is reviewed;
- observability does not leak sensitive data;
- migration/backward-compatibility impact is addressed;
- privacy impact is reviewed;
- documentation is updated;
- rollback path exists for production changes.

## Environments

- local development with synthetic data only;
- ephemeral PR/test environments with synthetic data only;
- shared staging with synthetic or irreversibly anonymized fixtures;
- production isolated by account/project/network boundary;
- separate secrets, keys, databases and storage per environment.

Production data must never be copied to lower environments.

## Release strategy

- feature flags for high-risk changes;
- database expand/migrate/contract pattern;
- backward-compatible API deployments;
- canary or small-cohort rollout where practical;
- automated rollback for health regressions;
- human approval gate for schema/security-sensitive production changes.

## Operations

- service-level indicators for API latency, errors, notification delivery and job queues;
- security alerts for abnormal auth/export/admin behavior;
- privacy-safe logs with request correlation IDs, not person names;
- documented on-call / incident ownership before GA;
- regular restore drills;
- dependency and platform update cadence.
