# Eutaktos Design System — Quiet Glass

## Purpose

Eutaktos must feel calm, welcoming and unusually pleasant to use without resembling Hourglass or any other congregation-management product.

The visual language is **Quiet Glass**: an original Eutaktos system inspired by the physical qualities associated with liquid glass — depth, translucency, soft highlights, layered surfaces and gentle motion — without cloning Apple layouts, components or interaction patterns.

The design serves the work. It must never make operational information harder to understand.

## Principles

1. **Calm before decoration** — the most important action or pending item is visually obvious.
2. **Soft depth, not visual noise** — translucency is reserved for structural surfaces and key cards.
3. **Original information architecture** — role-adaptive Eutaktos workflows define layout and navigation; competitor layouts are not copied.
4. **Motion explains state** — animations indicate entrance, hierarchy, selection or completion. Decorative perpetual motion is avoided.
5. **Performance is a feature** — delight cannot create jank, excessive battery use or large JavaScript bundles.
6. **Accessibility can override aesthetics** — high contrast, reduced motion and reduced transparency are first-class user preferences.
7. **Touch and desktop both matter** — the same design language adapts, rather than simply shrinking a desktop screen.

## Surface model

Use four conceptual layers:

- **Canvas** — low-contrast atmospheric background, no information dependency.
- **Structural glass** — navigation and major framing surfaces.
- **Content glass** — cards containing assignments, alerts and planning information.
- **Action material** — opaque/high-contrast controls for primary actions and sensitive decisions.

Do not stack blur on blur unnecessarily. Avoid translucent text fields over complex moving backgrounds.

## Performance rules

- Prefer CSS-only visual treatment over runtime JavaScript effects.
- Animate primarily `transform` and `opacity`.
- No continuous parallax, cursor-following glass, particle systems or animated background shaders in normal product use.
- Backdrop blur is limited to major surfaces and must have an opaque fallback.
- Avoid permanent `will-change` declarations.
- Keep entrance motion short (generally <= 450ms) and interaction feedback near 150–200ms.
- Respect `prefers-reduced-motion` and the Eutaktos reduced-motion preference.
- Use `content-visibility` only where it does not break accessibility or focus behavior.
- Performance budgets will be enforced with production builds and device testing before GA.

## Accessibility rules

- WCAG 2.2 AA remains the release floor.
- Text contrast is evaluated against the effective composited surface, not just raw token colors.
- Important status is never represented by blur, color or translucency alone.
- Focus indicators remain visible over every glass surface.
- A **Reduce transparency** preference converts glass surfaces to stable opaque surfaces and removes ambient decorative layers.
- High-contrast mode increases surface opacity/border separation and may remove subtle visual effects.
- Reduced motion removes non-essential entrance and hover movement.

## Motion language

Allowed examples:

- small card entrance: fade + <= 8px vertical translation;
- selected navigation: short material/position transition;
- button press: tiny transform feedback;
- confirmation: brief state transition, no celebratory loop;
- loading: restrained progress/skeleton only where waiting is real.

Avoid:

- springy/bouncy motion on routine administrative actions;
- large scale zooms;
- motion that shifts surrounding content unexpectedly;
- animations that delay input;
- background animation that continues indefinitely.

## Responsive behavior

Desktop/tablet may use a floating glass navigation rail. On smaller screens it becomes a reachable bottom navigation surface. Cards change composition and ordering based on task priority, not fixed desktop proportions.

Minimum supported design checks include narrow phones, large phones, tablets, landscape, desktop, 200%/400% zoom and increased text size.

## Personalization

User preferences are independent of congregation defaults:

- light / dark / system theme;
- accessible accent palette (planned);
- language and locale;
- comfortable / compact density;
- high contrast;
- reduced motion;
- reduced transparency;
- text scale/readability preferences (planned).

Personalization must remain constrained by semantic design tokens so users cannot create inaccessible foreground/background combinations.

## Originality guardrail

Hourglass, NW Publisher and other products may be studied for capability coverage and migration needs, but their screen composition, iconography, navigation and visual hierarchy are not templates for Eutaktos.

Eutaktos should be recognizable from a screenshot without its logo: quiet translucent framing, clear task hierarchy, generous spacing, soft geometry, restrained color and transparent explanations for intelligent recommendations.
