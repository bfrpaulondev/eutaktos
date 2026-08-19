# Architecture

## Client architecture: PWA first

The initial Eutaktos client is a **single Progressive Web App** that serves administration and publisher workflows across:

- desktop browsers;
- Android phones/tablets;
- iPhone/iPad;
- installable home-screen mode where supported.

The PWA is the canonical product surface. Core functionality must never require an app-store installation.

### PWA rules

- mobile-first responsive layout with progressive enhancement for larger screens;
- no separate mobile feature subset: capability is permission-driven, not device-driven;
- service worker is allowed only for explicitly classified cacheable resources/data;
- sensitive API responses are not blindly cached;
- logout/revocation must clear protected local state;
- offline writes use an explicit queue only for workflows proven safe to replay/idempotently process;
- application version/schema compatibility is checked before queued writes are submitted;
- local storage/IndexedDB content containing personal data is minimized and threat-modeled;
- background sync and push are progressive enhancements, never the sole delivery path;
- native wrappers/clients require a future ADR and must justify their extra attack and maintenance surface.

### Responsive breakpoints are not the design

Components are built around available space, content and input mode rather than a small fixed list of devices. Critical workflows are tested on narrow phones, large phones, tablets, desktop widths, portrait/landscape and high zoom.

## Accessibility architecture

Accessibility is part of the component contract.

- WCAG 2.2 AA is the minimum release target; relevant AAA criteria are pursued where practical.
- Native semantic HTML is preferred over custom ARIA widgets.
- WAI-ARIA Authoring Practices are followed for complex widgets.
- Every shared UI component defines keyboard, screen-reader, focus, contrast, motion and error-state behavior.
- Theme tokens must preserve required contrast combinations; users cannot accidentally configure an unreadable theme.
- Localization must not break layout at longer text lengths.
- RTL support is treated as an architectural capability even if initial languages are LTR.
- Accessibility regressions in critical journeys block release.

See `docs/UX-ACCESSIBILITY.md`.

## Architectural boundaries

Eutaktos separates business domains so a compromise or bug in one workflow does not automatically expose all data.

Core domains:
- Identity & Access
- Congregation Directory
- Eligibility & Responsibilities
- Scheduling
- Public Talks
- Field Service
- Territories
- Reporting
- Tasks/Maintenance
- Communication
- Documents/Information Board
- Import/Export
- Smart Assign
- Review Center
- Audit

## Data isolation

Primary rule: every congregation-owned record is tenant-scoped. Authorization must be enforced server-side and tested at the repository/query boundary, not only hidden in UI.

Highly sensitive Review Center data should use a stronger separation boundary than normal schedule data, including separate encryption context and narrower authorization policy.

## AI boundary

The AI subsystem does not receive unrestricted database access. It receives explicitly prepared, permission-scoped tool results. External model calls should use pseudonymous identifiers and minimum necessary attributes.

The deterministic scheduler owns assignment validity. The LLM may explain or translate recommendations but cannot override eligibility constraints.

## Event model

Important state changes should emit domain events, for example:
- AssignmentCreated
- AssignmentDeclined
- AssignmentReplaced
- EligibilityChanged
- ReviewRequested
- ReviewDecisionRecorded
- ExportCreated
- SensitiveRecordAccessed

Audit storage is append-only and separate from mutable business state.

## Documents

Documents are private by default, stored outside the public web root, encrypted at rest, scanned for malicious content where appropriate, and delivered using short-lived authorized URLs.
