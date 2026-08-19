# UI Component Standard

## Decision

Eutaktos uses **Material UI (MUI)** as the reusable React component foundation instead of rebuilding standard controls and layout primitives from scratch.

Why:
- mature, reusable React components;
- first-class responsive breakpoints/layout helpers;
- strong theming support;
- accessibility work already built into standard components;
- reduces implementation time and maintenance surface;
- lets Eutaktos keep its own Quiet Glass visual identity through theme overrides instead of copying Material Design defaults.

MUI is a component foundation, **not the visual identity**. Eutaktos continues to use its original Quiet Glass design language.

## Approved palette presets

Only these six product palettes are approved. Custom arbitrary colors are not exposed to users.

1. **Neutral Classic — default**
   - `#FAFAFA`
   - `#F2F2F2`
   - `#1A1A1A`
   - `#6B6B6B`
   - `#3B82F6`

2. **Neutral Warm**
   - `#F7F3EE`
   - `#EDE8E0`
   - `#2C2926`
   - `#8A837B`
   - `#C17B5C`

3. **Monochrome + Green**
   - `#FFFFFF`
   - `#F5F5F5`
   - `#222222`
   - `#777777`
   - `#5B8A72`

4. **Pastel Blue**
   - `#F0F5F9`
   - `#FFFFFF`
   - `#1E3A5F`
   - `#64748B`
   - `#3B82F6`

5. **Minimal Dark**
   - `#121212`
   - `#1E1E1E`
   - `#EDEDED`
   - `#A0A0A0`
   - `#60A5FA`

6. **Soft Pastel**
   - `#FDF8F4`
   - `#F8EDE8`
   - `#3F3A37`
   - `#8C8179`
   - `#D4A5A5`

## Rules

- Palette 1 is the product default.
- Palette choice is a per-user preference.
- UI implementation should prefer MUI primitives/components (`Box`, `Stack`, `Grid`, `Card`, `Button`, `Select`, `Switch`, `BottomNavigation`, `Drawer`, dialogs, forms, feedback, etc.).
- New custom components are justified only when the product interaction is genuinely specific to Eutaktos.
- Responsive behavior should use MUI theme breakpoints and CSS-first responsive props where possible.
- Components must preserve WCAG 2.2 AA requirements and support keyboard, screen readers, reduced motion, high contrast and reduced transparency.
- Quiet Glass effects must remain restrained and performant; MUI component overrides should favor CSS `opacity`, `transform`, borders and limited `backdrop-filter` instead of heavy runtime animation.
- Avoid adding a second general-purpose component framework without an ADR.
