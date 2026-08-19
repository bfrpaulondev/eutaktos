# ADR 0004 — PWA-first accessible client

Status: Accepted for initial architecture

## Context

Eutaktos must serve publishers and administrative roles on desktop, Android and iPhone/iPad while remaining free, maintainable and consistent. Separate native clients would multiply development, security review, accessibility work, release pipelines and regression risk before a proven native-only requirement exists.

The target users have varied ages, devices, technical confidence, accessibility needs and languages.

## Decision

The initial canonical client will be an installable **Progressive Web App (PWA)**.

- One responsive application covers browser, desktop, Android and iPhone/iPad use.
- Installation is optional; core workflows work in the browser.
- The UI is mobile-first but not mobile-only.
- WCAG 2.2 AA is the minimum release target.
- Per-user language, theme and accessibility preferences are architectural primitives.
- Service-worker caching/offline features are opt-in per data class and threat-modeled.
- Native apps/wrappers require a future ADR demonstrating a capability or distribution requirement that materially justifies the additional surface.

## Consequences

Positive:
- one capability surface and design system;
- faster security/accessibility fixes across platforms;
- lower cost for a donation-supported product;
- simpler multi-language delivery;
- lower risk of platform feature drift.

Trade-offs:
- some OS integrations may be weaker than dedicated native apps;
- iOS/Android PWA capabilities and browser policies require ongoing compatibility testing;
- offline storage must be conservative because of sensitive data.

## Guardrails

- no business rule exists only in the client;
- authorization remains server-side;
- PWA cache never becomes an uncontrolled second database;
- critical actions require online confirmation unless an offline workflow has explicit conflict/idempotency design;
- critical journeys are tested in Android Chrome, iPhone Safari and desktop browsers.
