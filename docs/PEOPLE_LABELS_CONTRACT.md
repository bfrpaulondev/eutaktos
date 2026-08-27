# People labels contract

This document defines the canonical server/domain boundary for **PX9.3 labels/tags**. It is intentionally small: labels are explicit administrative metadata attached to a person so authorized responsible users can group and filter People records without creating another permanent navigation area.

## Contract

- Storage owner: `CongregationPerson.labels`.
- Read authority: existing server-derived `people.read`.
- Write authority: existing server-derived `people.read + people.write` through the canonical People PATCH flow.
- Browser payload may contain only the desired label strings. Tenant, actor and capabilities remain resolved from the authenticated server session.
- Labels are optional. Legacy people without a labels property are equivalent to an empty label set.
- Maximum 20 labels per person.
- Maximum 40 characters per label.
- Whitespace is normalized; empty/control-character labels are rejected.
- Duplicate labels are collapsed case-insensitively and persisted in deterministic display order.
- Removing all labels clears the optional persisted label field.

## Privacy and semantic boundary

Labels are **human-authored administrative metadata**, not inference results. The product must not automatically generate labels from spirituality, personal worth, health, ethnicity, sex, family circumstances or other sensitive/personal attributes. A label is not eligibility and must never be consumed as an implicit eligibility decision or recommendation score.

Directory responses may include explicitly persisted label names under `people.read`, because filtering is the intended PX9.3 use. Contact, emergency-contact, eligibility and availability values remain excluded from the general People DTO and continue to use their existing capability-specific contracts.

Audit/domain-event records contain only the changed-field marker `labels`; label values are not copied into audit summaries, domain-event metadata, URLs, logs, analytics, browser storage or service-worker cache.

## UI follow-up required for PX9.3 completion

The server/domain contract in this document does not by itself complete PX9.3. The remaining UI slice must:

1. expose label editing only when `people.write` is present;
2. show existing labels read-only under `people.read` when write authority is absent;
3. provide a Directory label filter using only labels returned by the canonical People DTO;
4. preserve loading/error/retry and stale-response ownership;
5. support pt-PT/en/es;
6. keep labels in low-frequency People tooling/filter surfaces rather than adding another permanent top-level navigation item;
7. add browser regression for edit -> authoritative refetch -> filter, 401/403 and duplicate-submit behavior.
