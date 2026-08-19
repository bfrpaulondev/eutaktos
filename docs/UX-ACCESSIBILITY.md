# UX, PWA and Accessibility Standard

## Product promise

Eutaktos should feel **calm, obvious, fast and pleasant**. Users should not need technical confidence to understand what requires attention, what will happen next, or how to recover from a mistake.

The initial application is a **Progressive Web App (PWA)** usable as:
- a normal website;
- an installed Android home-screen app;
- an installed iPhone/iPad home-screen web app where supported;
- a tablet app-like experience;
- a full desktop administration experience.

One codebase does not mean one cramped layout. The information architecture and components adapt to available space, input type, user role and accessibility preferences.

## Non-negotiable accessibility target

- WCAG 2.2 Level AA is the release floor.
- Relevant AAA success criteria are adopted when they improve usability without creating a conflicting requirement.
- Native HTML semantics first.
- WAI-ARIA only when semantics/behavior cannot be expressed with native controls.
- WAI-ARIA Authoring Practices used as implementation guidance for custom complex widgets.
- Accessibility defects in critical journeys can block a release.

## Core inclusive-design requirements

### Perceivable
- Text and important UI must meet required contrast.
- Color is never the only way to communicate state.
- Text can resize and reflow without loss of information or function.
- Icons have accessible names when they convey meaning.
- Motion is reduced/removed when the user requests reduced motion.
- Documents/images uploaded to information boards need accessible descriptions/workflows where applicable.

### Operable
- Every function is keyboard operable.
- Focus is always visible and logically ordered.
- No critical function is hover-only, swipe-only or drag-only.
- Drag/drop workflows have non-drag alternatives.
- Touch targets are comfortably sized and spaced.
- Time-sensitive actions avoid unnecessary time limits.
- Modals, menus, comboboxes, calendars and grids implement expected keyboard behavior.

### Understandable
- Plain, respectful language.
- Destructive/sensitive operations show their impact before confirmation.
- Errors identify the field/problem and explain recovery.
- Forms preserve safe entered data after validation errors.
- Smart/AI recommendations always show that they are recommendations and why they were made.

### Robust
- Semantic landmarks/headings.
- Correct names, roles, states and relationships.
- Screen-reader announcements for asynchronous state changes where needed.
- Progressive enhancement: a temporary loss of push/offline capability must not make core data inaccessible.

## Personalization

Preferences are individual and must not unexpectedly alter congregation-wide settings.

Supported preference model:
- language;
- locale formatting;
- light/dark/system theme;
- accessible accent palette;
- standard / high-contrast presentation;
- font size scale;
- readable-font option;
- compact / comfortable density;
- reduced motion;
- reduced transparency where applicable.

Custom colors are constrained through accessible design tokens. The system may adjust foreground/background combinations to preserve contrast rather than permit an unreadable theme.

## Internationalization

Architecture requirements:
- no hard-coded visible strings in product code;
- ICU-style message formatting or equivalent;
- plural/gender-sensitive grammar support where needed;
- local date/time/number formatting;
- explicit congregation timezone;
- user UI language independent from congregation language;
- long-string/pseudo-localization testing;
- RTL-ready CSS/layout from the design-system layer;
- translation fallback chain;
- translation versioning so critical notification templates are not partially translated.

Initial language order can be chosen later based on pilot congregations; the architecture must not assume Portuguese-only data.

## Role-adaptive UX

Navigation prioritizes what the current user can and needs to do.

Examples:
- a publisher lands on upcoming assignments, service arrangements and notices;
- a school overseer sees unfilled/unconfirmed parts and balanced-assignment tools;
- an AV coordinator sees current AV coverage and substitutions;
- a secretary sees reporting tasks;
- restricted reviewers see Review Center only when authorized.

Permissions remain server-side. Role-adaptive UX hides noise, not security boundaries.

## PWA behavior

### Installation
Installation is optional. Core flows work in the browser. The product may provide contextual, dismissible instructions for adding Eutaktos to the home screen.

### Offline / weak network
Offline capability is conservative because the data is sensitive.

Allowed candidates:
- encrypted/minimized personal upcoming schedule cache;
- previously opened non-sensitive configuration required for display;
- draft form state where loss would frustrate the user and storage is justified.

Not automatically cached:
- restricted Review Center data;
- broad congregation directory exports;
- generated reports;
- sensitive documents;
- authentication/session secrets beyond secure platform mechanisms.

Offline writes are enabled only after the workflow has explicit idempotency, conflict and revocation behavior.

### Updates
A stale service worker must never strand the user on a broken schema.

Required:
- version handshake with API;
- controlled cache invalidation;
- safe “update available” flow where necessary;
- tests from previous deployed PWA version to current;
- recovery path if cached assets become corrupt.

## Performance / delight budgets

The app should remain comfortable on ordinary and older phones.

Budgets will be formalized after the technology ADR, but principles are:
- fast first meaningful screen;
- skeletons/progress only when useful, not decorative;
- optimistic UI only where rollback is safe;
- avoid huge JavaScript bundles;
- route/code splitting;
- virtualize genuinely large lists without harming accessibility;
- images/documents optimized;
- no unnecessary animation;
- interaction feedback should feel immediate.

## Accessibility test matrix

Automated tools do not certify accessibility. Every release candidate with major UI changes includes manual testing.

Minimum manual matrix:
- keyboard-only desktop;
- VoiceOver + Safari;
- TalkBack + Android Chrome;
- 200% and 400% zoom/reflow;
- increased OS/browser text;
- light/dark/high-contrast modes;
- reduced motion;
- portrait/landscape;
- narrow phone / tablet / desktop;
- long translated strings.

## UX research

Before general availability, pilot testing should deliberately include:
- older users;
- users who rarely install apps;
- users with low vision;
- screen-reader users where available;
- users with reduced dexterity;
- users on older/mid-range phones;
- multilingual users;
- administrative users managing complex schedules.

Success is measured by completion rate, time-on-task, error/recovery rate, accessibility issues and qualitative confidence—not by visual novelty.
