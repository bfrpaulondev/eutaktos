# Testing and Quality Strategy

## Test layers

### Unit
Pure domain rules: date logic, eligibility filters, schedule conflicts, fairness calculations, permission helpers.

### Property-based
Critical scheduler invariants, for example:
- an ineligible person is never assigned;
- an unavailable person is never auto-assigned;
- hard max-frequency rules are never violated;
- same slot cannot have duplicate exclusive assignments;
- deterministic inputs produce deterministic rankings.

### Integration
Run against real ephemeral database/queue/storage dependencies where practical. Mocking the persistence layer is not sufficient for authorization/data-isolation tests.

### Contract
Machine-readable API/event contracts. Backward compatibility checked in CI.

### E2E PWA across web/mobile form factors
User journeys by role:
- publisher;
- school overseer;
- public-talk coordinator;
- secretary;
- service overseer;
- territory servant;
- AV/duties coordinator;
- restricted reviewer;
- congregation admin.

### Migration
Golden files, malformed files, round trips, rollback and idempotency.

### Security
Authorization matrices, tenant isolation, fuzzing, DAST, dependency/SAST scans, session-revocation tests.

### Accessibility
Accessibility is a release gate, not a snapshot score.

Automated:
- axe-core or equivalent checks on component stories and critical E2E routes;
- semantic/ARIA assertions;
- color-contrast token tests;
- focus-order and focus-visible regression tests where automatable;
- no horizontal loss of function at required reflow/zoom scenarios.

Manual:
- keyboard-only navigation;
- VoiceOver on iPhone/iPad and macOS;
- TalkBack on Android;
- at least one major desktop screen reader/browser combination;
- 200% and 400% zoom/reflow scenarios;
- OS/browser larger-text settings;
- high contrast / forced colors where supported;
- reduced motion;
- switch/limited-dexterity-friendly interaction review;
- error identification, prevention and recovery.

Target: WCAG 2.2 AA minimum, with relevant AAA success criteria adopted where feasible. Critical accessibility defects block release.

### PWA/platform matrix
Critical journeys run against a maintained browser/device matrix covering:
- Chromium desktop;
- Firefox desktop;
- Safari/macOS;
- Android Chrome;
- iPhone Safari;
- iPad Safari;
- installed standalone PWA mode where CI/device infrastructure permits;
- online, slow-network and safe offline/read-cache scenarios;
- service-worker upgrade from N-1 to current version.

### Responsive
Visual and functional regression at narrow phone, large phone, tablet and desktop widths, portrait/landscape, long translations and 400% zoom. No workflow may rely on hover-only controls.

### Localization
Timezone, DST, locale, pluralization, text expansion, RTL readiness, locale-specific formatting and independent user/congregation languages. Translation keys must never be assembled dynamically in ways that defeat extraction/testing.

### Personalization/themes
Every supported theme/accent mode is checked against contrast rules. User-selected theme, density, font-size, language and reduced-motion preferences persist safely without changing congregation-wide settings.

### Performance
Load, soak and queue-backlog tests for schedule generation, mass notifications, imports and report generation.

### Resilience
Backup restore, key rotation rehearsal, dependency outage, queue retry, duplicate event and partial-failure tests.

## Quality gates

Critical domain/security code receives stricter review and test expectations than presentation code. Coverage percentage is a signal, not the definition of quality.

No release with:
- known critical/high exploitable security defect;
- unresolved cross-tenant data issue;
- broken backup restore;
- failing critical E2E journey;
- critical WCAG 2.2 AA regression;
- PWA update/offline behavior capable of corrupting or leaking sensitive data;
- unreviewed database migration affecting sensitive data.
