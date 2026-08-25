# Eutaktos Design System — Clarity First

> Active Product Experience design guidance.
>
> Read together with `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`. If older visual guidance conflicts with the master plan, the master plan wins.

## Purpose

Eutaktos must feel calm, welcoming and unusually easy to understand without resembling Hourglass or another congregation-management product.

The visual system is now **clarity first, with restrained Quiet Glass as optional brand flavor**. Depth, soft geometry and limited translucency may help frame the product, but operational information must never depend on blur, transparency or decorative effects.

The five-second requirement is the design test: a responsible person should quickly understand where they are, what needs attention and what action is most useful next.

## Component foundation

**Ant Design 6 is the primary component foundation for all newly rebuilt Product Experience surfaces.**

Use Ant primitives before creating custom equivalents: `Layout`, `Menu`, `Card`, `Table`, `List`, `Form`, `Steps`, `Tabs`, `Drawer`, `Modal`, `Alert`, `Result`, `Empty`, `Skeleton`, `Tag`, `Badge`, `Select`, `DatePicker`, `Dropdown` and related accessible components.

Migration is incremental. Existing MUI screens may continue behind a documented compatibility boundary until their workflow is rebuilt and accepted. Do not create a new Product Experience screen with MUI merely because an adjacent legacy screen still uses it.

Do not mix Ant and MUI within the same newly rebuilt screen except at a deliberate migration boundary approved by the principal agent.

## Product design principles

1. **Attention before navigation** — unresolved or time-sensitive work appears before low-value browsing.
2. **Tasks before entities** — navigation speaks the user's goal, not internal domain architecture.
3. **Context before CRUD** — related information should be understandable together.
4. **One obvious primary action** — where possible, each context has one dominant next action.
5. **Explain recommendations** — intelligent assistance always exposes operational reasons.
6. **Human control remains final** — suggestions never masquerade as decisions or completed writes.
7. **Progressive disclosure** — reveal complexity when the current task needs it.
8. **Privacy by design** — sensitive data is visible only when workflow and capability justify it.
9. **Mobile is first class** — not a shrunken desktop layout.
10. **Accessibility outranks decoration** — WCAG 2.2 AA remains the release floor.

## Semantic visual layers

Use semantic tokens rather than screen-specific hard-coded colors.

Required layers:

- **Canvas** — application background.
- **Navigation surface** — clearly separated from canvas.
- **Primary content surface** — cards, tables and forms.
- **Elevated surface** — drawers, modals, popovers.
- **Selected/active surface** — unmistakable current context.
- **Primary action** — the strongest action emphasis.
- **Success** — healthy/completed.
- **Warning** — attention needed, not destructive.
- **Danger** — destructive/critical.
- **Info** — explanatory state.
- **Muted** — secondary information that remains legible.

Color is never the only carrier of state. Pair semantic color with text, icon, shape or accessible labeling.

## Themes

Supported color modes:

- Light
- Dark
- System

Required behavior:

- switching is immediate;
- no page reload is required;
- preference persists safely;
- explicit Light remains light even if the OS is dark;
- explicit Dark remains dark even if the OS is light;
- System follows OS color-scheme changes;
- Ant components and custom surfaces remain coherent;
- no white-on-white, dark-on-dark or illegible disabled/secondary states;
- status remains understandable without color alone.

Build one excellent semantic light/dark pair before adding optional accent palettes. A legacy palette must never override the selected color mode.

## Density and typography

The default experience is comfortable rather than spreadsheet-dense.

- Comfortable is the default density.
- Compact may be offered to power users.
- Text-size preferences remain supported.
- Larger text must reflow without clipping controls or hiding essential actions.
- Long translations in pt-PT/en/es must be considered in layout, not shortened into ambiguous labels solely to fit a component.

## Quiet Glass usage

Quiet Glass is optional flavor, not architecture.

Allowed:

- a restrained navigation or elevated surface treatment;
- soft depth and subtle borders;
- limited translucency where text contrast remains reliable;
- an opaque fallback that looks intentional.

Avoid:

- blur stacked on blur;
- translucent text fields over complex backgrounds;
- glass treatment on every card;
- decorative atmosphere competing with alerts, tables or forms;
- visual effects that make Light/Dark/System inconsistent.

The **Reduce transparency** preference must replace translucent treatments with stable opaque surfaces.

## Motion

Motion communicates state; it does not decorate routine administration.

Allowed examples:

- small entrance fade + <= 8px translation;
- short selected-navigation transition;
- restrained button feedback;
- brief confirmation-state transition;
- real progress/skeleton while data is loading.

Avoid:

- perpetual background motion;
- springy/bouncy administrative actions;
- large zooms;
- motion that shifts surrounding content unexpectedly;
- animation that delays input.

Respect `prefers-reduced-motion` and the Eutaktos reduced-motion preference. Prefer `transform` and `opacity` when animation is necessary.

## Responsive behavior

The shell uses task-oriented responsive composition:

- desktop/tablet may use a persistent side navigation surface;
- narrow layouts use reachable bottom navigation and a focused secondary drawer/menu;
- safe-area insets are respected;
- content changes composition/order by task priority rather than fixed desktop proportions.

Minimum automated layout checks include 320, 375, 390, 430, 768, 1024, 1280 and 1440 px, plus 200%/400% zoom/reflow where applicable during acceptance.

No supported primary screen may require horizontal scrolling for ordinary operation.

## Loading, empty, error and degraded states

Every asynchronous Product Experience surface must intentionally handle the states that can actually occur:

- loading;
- empty/no results;
- unauthorized/forbidden where relevant;
- retryable failure;
- non-retryable failure where relevant;
- partial/degraded data when useful;
- abort/stale-request ownership.

Do not show fake success while data is unavailable. A previous response must never overwrite a newer request.

## Forms and actions

- Validation appears close to the relevant field.
- Required vs optional data is explicit.
- Long forms use progressive/guided steps where the task benefits from them.
- Double submit is prevented.
- Destructive navigation warns about unsaved changes.
- Cancellation is safe.
- Server-side authorization and validation remain authoritative.
- A success state is shown only after the server confirms persistence.

## Accessibility

- WCAG 2.2 AA is the minimum release floor.
- Keyboard workflows and visible focus are mandatory.
- Skip-to-content and semantic landmarks are preserved in the application shell.
- Dialog/drawer focus is trapped/restored appropriately.
- Screen-reader names describe the actual action.
- Important state is not represented by color, blur or motion alone.
- High-contrast, reduced-motion, reduced-transparency, density and text-size preferences remain first-class.

## Privacy and security in UI design

Visual convenience never weakens the server security model.

- Tenant, actor and capabilities are server-derived.
- Do not place sensitive identifiers or PII in URLs unless explicitly reviewed and necessary.
- Browser storage is limited to approved non-sensitive preference/state data.
- Private authenticated API responses are not service-worker cached.
- Emergency/contact views use least privilege.
- Exports are explicit actions and use the minimum-data principle.
- AI output is advisory and does not expose model secrets or bypass normal capability-checked commands.

## Originality guardrail

Hourglass, NW Publisher and other products may be studied for capability coverage and migration needs. Their layouts, navigation, iconography and screen composition are not templates.

Eutaktos should be recognizable by:

- task-oriented navigation;
- strong attention hierarchy;
- calm semantic surfaces;
- generous but purposeful spacing;
- clear explainability for recommendations;
- restrained color and decoration;
- safe, guided next actions.

If a screen looks modern but the user still has to learn the internal data model before knowing what to do, the design is not finished.
