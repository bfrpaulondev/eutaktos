# PX9.17 People DOCX export — product decision

> Decision recorded 2026-08-27 against `main` `39d396c812a9db79f5c405b5b635d5bafe89b6ed`.

## Decision

**PX9.17 DOCX is not required for technical completion of the People reference module. It remains intentionally deferred unless later user testing demonstrates a concrete workflow that CSV and PDF do not satisfy.**

This is a product-scope decision, not an implementation failure and not a technical blocker.

## Evidence in the current product sources

The repository already defines DOCX as conditional rather than mandatory:

- `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md` defines PX9.17 as “DOCX export only if product need remains after user testing; do not implement solely for competitor parity” and marks it intentionally research-deferred.
- `docs/AI_HANDOFF.md` states that PX9.17 is research-deferred and that CSV/PDF already cover the approved export needs.
- `docs/PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md` repeats that DOCX must not be added solely for parity.
- `docs/FEATURES.md` classifies DOCX as P2 “where useful”, not as a required P0/P1 People capability.
- `docs/IMPORT-EXPORT.md` likewise lists DOCX only “where useful”.
- Repository issue search on 2026-08-27 found no open DOCX/PX9.17 implementation issue establishing a contrary requirement.

## Existing approved export coverage

People already has approved export/report paths that cover the currently defined needs:

- safe CSV export for tabular data;
- controlled Record Cards/report projection;
- direct PDF export from the authorized minimum-data Record Cards projection.

Adding DOCX now would create an additional document-generation dependency and another privacy/rendering surface without an approved workflow that needs it.

## Privacy and architecture boundary if reconsidered later

If PX9.17 is reopened later, it must:

- start from an explicit user-tested need, not competitor parity;
- reuse an existing authorized minimum-data server projection where possible;
- never widen Directory, Contact List, Record Cards or generic Person DTOs merely to feed DOCX;
- preserve server-derived tenant, actor and capability authority;
- not introduce additional PII into logs, audit, events, URLs, analytics or browser persistence;
- define deterministic rendering, localization and accessibility expectations before implementation;
- pass the same quality/privacy/browser/canonical Netlify gates as other People exports.

## Completion semantics

For People technical closeout:

- PX9.17 is **DEFERRED / NOT REQUIRED**;
- it must not be counted as unfinished technical implementation;
- its unchecked historical master-plan checkbox must not be interpreted as a blocker;
- it may be reopened only when new product evidence establishes a concrete need.

This decision does not mark a DOCX implementation as completed; it explicitly records that no DOCX implementation is currently required.