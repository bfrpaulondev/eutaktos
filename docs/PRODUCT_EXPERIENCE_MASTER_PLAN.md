# EUTAKTOS PRODUCT EXPERIENCE MASTER PLAN

> **SOURCE OF TRUTH FOR THE PRODUCT EXPERIENCE REBUILD**
>
> Status: ACTIVE — highest product priority
> Created: 2026-08-25
> Baseline main when this plan was created: `be68797922b2a9f96b5fe47e906a95cdfbcf77cb`
> Canonical production: `https://eutakes.netlify.app/`
> First reference module: **Pessoas / People**
> Accepted People core product/runtime SHA: `f013f72722c18a6df06ad7c6390be668ed239dbf` — C6 independent acceptance `ACCEPT`, 2026-08-26.
>
> C6 acceptance closes the currently integrated People core composition. It does **not** fabricate completion for the explicit unchecked contract/product gaps retained below, nor for PX8/PX9/PX11.

---

## 0. Why this document exists

The Eutaktos backend/domain/security foundation is significantly more mature than the current user experience. The current application can expose data and operations, but it still feels too much like a collection of administrative screens. That is not enough.

The product must help a congregation responsible person understand, in a few seconds:

1. what needs attention;
2. why it needs attention;
3. what the safest next action is;
4. which people are reasonable candidates when a choice is required;
5. what conflicts, absences, eligibility constraints or workload imbalances exist.

The goal is not to clone Hourglass. Hourglass is a capability reference. Eutaktos must preserve the useful operational coverage while making the experience simpler, more guided, more explainable and more pleasant.

**Until this plan is explicitly superseded, this file controls UI/UX and People-product priorities.** Historical pilot/acceptance documents remain evidence of previous technical work, but they do not override this product direction.

---

## 1. Mandatory agent protocol

Every principal or worker agent MUST do this before coding:

- [ ] Fetch the latest `main` and record its SHA in the task/PR.
- [ ] Read `docs/AI_HANDOFF.md`.
- [ ] Read this entire file: `docs/PRODUCT_EXPERIENCE_MASTER_PLAN.md`.
- [ ] Identify the exact unchecked task ID being implemented.
- [ ] Confirm that no other active branch is implementing the same task.
- [ ] Check the current implementation before assuming a feature is missing.
- [ ] Keep one task or one tightly coupled slice per branch.
- [ ] Preserve tenant isolation, capabilities, audit, domain events and privacy rules.
- [ ] Add or update automated tests for every behavior changed.
- [ ] Run the required quality/browser gates before asking for integration.
- [ ] Never declare a checkbox complete merely because code exists on a worker branch.

### Checkbox ownership

**Only the principal/integration agent may change a task from `[ ]` to `[x]`.**

A task is checked only after all of the following are true:

`IMPLEMENTED → REVIEWED → TESTS GREEN → INTEGRATED MAIN → RELEVANT PRODUCTION/UX VERIFICATION COMPLETE`

Worker reports, screenshots, local tests or a green preview alone are not completion evidence.

When the principal checks a task, append evidence in the form:

`Evidence: PR #___ / main SHA ___ / gate ___`

If implementation is partial, leave the checkbox unchecked and describe the remaining work in the task notes or PR.

---

## 2. Product reset: what Eutaktos is now optimizing for

### 2.1 Product promise

Eutaktos is not a database UI. It is an **organization assistant**.

It should reduce the mental load of responsible people by combining reliable records with contextual guidance.

### 2.2 Core experience principles

1. **Attention before navigation** — show what needs action before showing modules.
2. **Tasks before entities** — organize common workflows around what the user is trying to accomplish.
3. **Context before CRUD** — show related information together instead of forcing the user through many isolated screens.
4. **Explain recommendations** — never display a mysterious ranking.
5. **Human decision remains final** — the system can recommend; it does not make spiritual or personal decisions for the responsible person.
6. **Progressive disclosure** — do not put 30 fields on screen when 6 are enough for the current step.
7. **Useful defaults, reversible actions** — reduce repetitive work while keeping important actions explicit.
8. **Privacy by design** — only expose sensitive data where the workflow and capability require it.
9. **Mobile is a first-class workflow** — especially contacts, emergency access, quick profile lookup, absence and meeting preparation.
10. **Visual hierarchy must be obvious** — surface, action, warning, success and secondary information cannot all look the same.

### 2.3 Five-second test

A user opening any primary Eutaktos area should be able to answer within roughly five seconds:

- Where am I?
- What is most important here?
- What needs my attention?
- What can I do next?

If the screen cannot answer these questions without training, it is not finished.

---

## 3. UI component decision — Ant Design 6

### Decision

Use **Ant Design 6** as the primary UI component foundation for the new product experience.

Reasons:

- Eutaktos already uses React 19; Ant Design 6 supports React >=18 and removes the React-19 patch requirement that applied to Ant Design 5.
- It provides mature accessible building blocks for enterprise/product workflows: Layout, Menu, Table, List, Card, Descriptions, Form, Steps, Drawer, Modal, Alert, Result, Empty, Skeleton, Segmented, Tabs, Tag, Badge, Dropdown, Select, DatePicker, Tour and more.
- `ConfigProvider` + design tokens + theme algorithms provide a much stronger base for reliable light/dark/system theming than hand-styling every component.
- Component tokens allow Eutaktos branding without rebuilding basic interaction primitives.

### Migration strategy

This is **not** a big-bang rewrite of every screen.

We will establish the new Ant Design foundation, rebuild **Pessoas** completely as the reference module, then migrate the remaining product areas using the patterns proven there.

Do not build new product-experience screens with MUI once the Ant foundation task is integrated, unless the principal explicitly approves a temporary exception.

Do not mix Ant and MUI components inside the same newly rebuilt screen except during a documented migration boundary.

MUI is removed only after all remaining consumers are migrated and quality/bundle/browser gates pass.

---

## 4. Eutaktos visual direction

The previous "Quiet Glass" idea may remain as restrained brand flavor, but **clarity wins over glass effects**. The new design must not depend on blur/transparency to feel modern.

### 4.1 Required semantic visual layers

- **Canvas** — application background.
- **Navigation surface** — distinct from canvas.
- **Primary content surface** — cards/tables/forms.
- **Elevated surface** — drawers, modals, popovers.
- **Selected/active surface** — unmistakable current context.
- **Primary action** — one obvious main action per context when possible.
- **Success** — completed/healthy.
- **Warning** — attention needed but not destructive.
- **Danger** — destructive/critical.
- **Info** — explanatory state.
- **Muted** — secondary information, never illegible.

### 4.2 Themes

Required modes:

- Light
- Dark
- System

Required behavior:

- switching is immediate;
- no reload required;
- preference persists;
- system mode follows OS changes;
- every Ant component, custom surface, chart/map shell and status color remains coherent;
- no white-on-white, dark-on-dark or unreadable disabled states;
- WCAG 2.2 AA remains the minimum release floor;
- color is never the only carrier of status.

### 4.3 Theme philosophy

Do not create six unrelated palettes before the base light/dark modes are excellent.

First make one excellent Eutaktos semantic palette in light + dark. Additional accent palettes are optional and come later.

### 4.4 Density

Default experience should be comfortable, not spreadsheet-dense.

Compact density may exist for power users, but the normal experience should use whitespace and grouping to reduce fatigue.

---

## 5. Information architecture — People first

### Primary product navigation target

- Início
- Preparar reunião
- Pessoas
- Organização
- Planeamento
- Administração

Do not expose technical domain boundaries as top-level navigation merely because they exist in code.

### People navigation target

Inside **Pessoas**:

- **Visão geral**
- **Diretório**
- **Grupos**
- **Mapa**

Primary action:

- `+ Adicionar pessoa`

Low-frequency operations go into **Ferramentas** instead of cluttering the permanent navigation:

- Importar
- Transferências
- Exportar
- Cartões/Registos
- Arquivo / A não publicar
- Etiquetas
- Lembretes

Emergency access must remain quickly reachable for users with the required capability, but it should not make the everyday directory visually noisy.

---

## 6. People — target experiences

### 6.1 People Overview

Do not begin with a raw table.

Target composition:

**Pessoas**

`128 pessoas · 9 grupos · 6 ausentes · 4 itens requerem atenção`

Then an actionable **Precisa da sua atenção** section.

Example cards:

> **3 perfis incompletos**  
> Faltam informações necessárias para algumas funcionalidades.  
> `Rever`

> **2 pessoas com designações afetadas por ausência**  
> Existem substituições que podem ser necessárias.  
> `Ver sugestões`

> **5 pessoas elegíveis sem participação recente**  
> Poderá querer considerá-las nas próximas designações.  
> `Ver pessoas`

> **2 alterações recentes de disponibilidade**  
> Podem afetar reuniões já preparadas.  
> `Analisar`

These examples are product behavior references, not hard-coded fake metrics.

### 6.2 Directory

Default directory must support:

- fast search;
- useful filter chips/dropdowns;
- responsive desktop table + mobile list/card presentation;
- clear group/status/availability context;
- quick access to the person profile;
- visible but restrained indicators for relevant states;
- export/bulk actions only when capability and context allow them.

Suggested top filters:

`Grupo` · `Disponibilidade` · `Elegibilidade` · `Responsabilidade` · `Estado` · `Mais`

Example row/card:

**João Silva**  
Grupo 3 · responsabilidade configurada  
Disponível esta semana  
Última designação: 5 semanas  
Próxima ausência: 12–18 setembro

### 6.3 Person profile

A person should have one coherent profile rather than multiple disconnected mini-CRUDs.

Target sections/tabs:

- Resumo
- Contactos
- Participação / Elegibilidade
- Disponibilidade
- Designações
- Organização
- Histórico

Example summary:

**João Silva**  
Publicador ativo · Grupo 3

**Estado**  
Disponível

**Próxima ausência**  
12–18 setembro

**Designações**  
Última: Leitura — 22 julho  
Próxima: nenhuma

**Elegível para**  
Leitura · Demonstração · outras capacidades explicitamente configuradas

**Responsabilidades**  
Responsabilidade configurada

Contextual recommendation example:

> **Sugestão**  
> João é um candidato razoável para uma das próximas leituras.  
> Disponível · Elegível · Sem conflito conhecido · Última participação há 5 semanas  
> `Ver reuniões disponíveis`

Never infer eligibility, role, spirituality, gender-based suitability or personal circumstances from unrelated profile data. Eligibility and constraints must come from explicit authorized configuration/domain rules.

### 6.4 Add/Edit person

Do not reproduce a single page containing dozens of fields.

Use a guided flow:

1. **Identidade** — essential identity fields.
2. **Contacto** — phone/email/address as permitted.
3. **Organização** — group/household/responsibilities.
4. **Participação** — explicit eligibility/availability configuration.
5. **Rever** — summary before save.

Rules:

- optional details stay collapsed until needed;
- validation occurs close to the field;
- destructive navigation warns about unsaved changes;
- submit button cannot duplicate requests;
- server remains authoritative;
- cancellation is safe;
- refresh after save must show persisted data, not optimistic fiction.

---

## 7. Explainable assignment recommendations

This is a **core product differentiator**, not a future AI add-on.

### 7.1 What the system may use

Only authorized, explicit or reliably derived operational data, such as:

- explicit eligibility for the assignment type;
- current availability / away periods;
- existing assignments in the same meeting/week;
- recent assignment history;
- conflicts;
- workload/rotation balance;
- explicit responsibility constraints;
- explicit manual exclusions or preferences that the product is allowed to store;
- assignment state and meeting state.

### 7.2 What it must not do

- Do not make the final decision automatically.
- Do not infer spirituality or personal worth.
- Do not infer sensitive attributes.
- Do not rank based on data the responsible person is not authorized to access.
- Do not hide the reason behind a recommendation.
- Do not treat absence of data as a positive fact.

### 7.3 Recommendation UI

Instead of a 100-person select:

**Escolher pessoa**

**Recomendados**

**1. João Silva — recomendado**  
Disponível  
Elegível para esta parte  
Última designação há 5 semanas  
Nenhuma outra designação esta semana

**2. Miguel Santos**  
Disponível  
Elegível  
Última designação há 3 semanas

**3. Carlos Ferreira**  
Disponível  
Elegível  
Já possui outra designação esta semana

`Ver todos os elegíveis`

### 7.4 Explainability contract

Every recommendation result must expose structured reasons that can be tested independently of UI wording.

Example reason codes:

- `ELIGIBLE`
- `AVAILABLE`
- `NO_MEETING_CONFLICT`
- `NO_WEEKLY_ASSIGNMENT`
- `LONGER_SINCE_LAST_ASSIGNMENT`
- `HAS_WEEKLY_ASSIGNMENT`
- `AWAY_DURING_MEETING`
- `NOT_ELIGIBLE`
- `CONFLICTING_ASSIGNMENT`

The UI localizes these reason codes in pt-PT/en/es.

---

## 8. Responsible-person assistance

Eutaktos should proactively turn data into safe next actions.

Required patterns include:

### Absence affects an assignment

> **Uma ausência afeta uma designação existente.**  
> Esta pessoa está marcada como ausente durante a reunião.  
> `Encontrar substituto`

### Meeting incomplete

> **Esta reunião ainda possui 3 partes sem designação.**  
> Existem pessoas elegíveis e disponíveis para análise.  
> `Completar reunião`

### Workload imbalance

> **Esta pessoa tem recebido designações com maior frequência do que outras pessoas elegíveis para esta parte.**  
> Existem alternativas disponíveis.  
> `Ver alternativas`

### Long interval

> **Há pessoas elegíveis disponíveis que não recebem uma designação há algum tempo.**  
> `Ver candidatos`

These are prompts for review, never automatic judgments.

---

## 9. Hourglass capability study — People parity and improvement

The supplied Hourglass screens demonstrate useful People capabilities. We need functional coverage where it adds real value, but Eutaktos should simplify the interaction and improve guidance.

| Capability observed | Eutaktos target |
|---|---|
| Add person | Guided, progressive form; clear required vs optional data |
| Transfer people | Guided send/receive workflow, state/history and explicit privacy explanation |
| Labels | Tags/labels with filters and useful grouping, without becoming navigation clutter |
| Send reminders | Attention/reminder workflow that explains who is missing what and when the last reminder occurred |
| Record cards | Controlled record/report generation with preview and capability checks |
| Do not publish / archive | Explicit archive state, reason, history and safe restore |
| Import | Import wizard with preview, validation, duplicate detection, dry-run and rollback where supported |
| Map | Useful group/people geography view with privacy and capability controls |
| Contact list | Searchable/filterable/exportable directory with responsive presentation |
| Emergency contacts | Purpose-built fast mobile emergency mode, strongly permissioned |
| CSV/PDF/DOCX exports | Configurable export where required, with minimum-data principle |

**Parity is not the finish line.** Each capability must answer: “How does Eutaktos make this easier or safer?”

---

## 10. Privacy and security rules for People

People data is sensitive operational data. UI convenience never weakens the existing security boundary.

Required:

- server-derived tenant/actor/capability context;
- no trust in tenant/actor/capabilities supplied by frontend;
- capability checks on every sensitive read/write;
- no unnecessary PII in logs, audit summaries, analytics or domain events;
- emergency/contact views use least privilege;
- exports are explicit user actions and audited where appropriate;
- map access is permissioned and should reveal no more precision than necessary for the task;
- browser storage contains only approved preferences/non-sensitive state;
- service worker must not cache authenticated private API responses;
- suggestion engine may use only fields the caller is allowed to use;
- audit entries must identify the operation without duplicating sensitive payloads.

---

## 11. Product Experience implementation backlog

### PX0 — Freeze, governance and source of truth

- [x] **PX0.1** Establish People-first product-experience reset and master plan.  
  Evidence: PR #267 / main SHA `1f95be15917e56dbf4212a835bb0bd74bdea4786` / quality + browser-regression PASS.
- [x] **PX0.2** Update `docs/AI_HANDOFF.md` so every agent is required to read this plan and recognizes Product Experience as the current priority.  
  Evidence: PR #267 / main SHA `1f95be15917e56dbf4212a835bb0bd74bdea4786` / quality + browser-regression PASS.
- [x] **PX0.3** Reconcile `docs/DESIGN-SYSTEM.md` with this plan; remove any guidance that conflicts with clarity-first Ant Design implementation.  
  Evidence: PR #292 / main SHA `4b7dbb20bb29be81470a270ec279288afed7f166` / quality + browser-regression PASS.
- [x] **PX0.4** Mark historical pilot documents as historical acceptance evidence where necessary so they cannot be mistaken for the active product backlog.  
  Evidence: PR #292 / main SHA `4b7dbb20bb29be81470a270ec279288afed7f166` / quality + browser-regression PASS.
- [x] **PX0.5** Inventory all current MUI imports/components and identify migration boundaries.  
  Evidence: PR #292 / main SHA `4b7dbb20bb29be81470a270ec279288afed7f166` / `docs/PRODUCT_EXPERIENCE_INVENTORY.md`; quality + browser-regression PASS.
- [x] **PX0.6** Inventory current People/domain/API capabilities versus the People target in this document; do not rebuild working backend behavior unnecessarily.  
  Evidence: PR #292 / main SHA `4b7dbb20bb29be81470a270ec279288afed7f166` / `docs/PRODUCT_EXPERIENCE_INVENTORY.md`; quality + browser-regression PASS.

### PX1 — Ant Design foundation and functioning themes

> **Principal accepted.** Technical foundation PR #283 plus lazy-recovery/visual hardening PR #304, independent #270 production acceptance, and final C6 exact-SHA/production evidence close PX1.1–PX1.14. C6 re-confirmed Light/Dark/System, pt-PT/en/es, browser privacy, bundle/runtime gates and responsive behavior at accepted product SHA `f013f72722c18a6df06ad7c6390be668ed239dbf`.

- [x] **PX1.1** Add Ant Design 6 and compatible Ant Design icons to `apps/web-pwa` using versions compatible with React 19.
- [x] **PX1.2** Create Eutaktos `ConfigProvider` foundation with semantic design tokens.
- [x] **PX1.3** Implement one excellent Light theme.
- [x] **PX1.4** Implement one excellent Dark theme.
- [x] **PX1.5** Implement System mode that reacts to OS theme changes.
- [x] **PX1.6** Persist color-mode preference safely.
- [x] **PX1.7** Implement semantic status tokens: success/warning/danger/info/muted/selected.
- [x] **PX1.8** Implement comfortable default density and optional compact density.
- [x] **PX1.9** Preserve locale/direction integration through the Ant foundation.
- [x] **PX1.10** Preserve reduced motion/high contrast/reduced transparency preferences or replace them with equally functional Ant/token implementations.
- [x] **PX1.11** Add automated theme tests covering light/dark/system and persistence.
- [x] **PX1.12** Add browser visual checks for core Ant primitives in both themes.
- [x] **PX1.13** Confirm bundle budget after Ant introduction; prevent accidental whole-library/bloat patterns.
- [x] **PX1.14** Establish migration rule preventing new MUI product screens after foundation integration.

Evidence PX1.1–PX1.14: PR #283 + PR #304 / main ancestry through accepted product SHA `f013f72722c18a6df06ad7c6390be668ed239dbf` / independent issue #270 + C6 final acceptance + quality/browser/PWA/bundle gates PASS.

### PX2 — New application shell and task-oriented navigation

- [x] **PX2.1** Rebuild desktop shell using Ant Layout/Menu patterns with clear active state and visual hierarchy.  
  Evidence: PR #291 / main SHA `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` / quality + browser-regression PASS; final `eutakes` Netlify preview success at PR head `1168e2dbb5f3f1b5ce65d86b5391e7e35992675a`.
- [x] **PX2.2** Rebuild mobile shell with reachable navigation and safe-area handling.  
  Evidence: PR #291 / main SHA `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` / browser-regression PASS at 320px plus final `eutakes` Netlify preview success.
- [x] **PX2.3** Implement target top-level information architecture: Início / Preparar reunião / Pessoas / Organização / Planeamento / Administração.  
  Evidence: PR #291 / main SHA `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` / pt-PT/en/es browser runtime PASS plus final `eutakes` Netlify preview success.
- [x] **PX2.4** Preserve deep links, browser back/forward and refresh routing.  
  Evidence: PR #291 / main SHA `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` / production-mount + browser-regression PASS plus final `eutakes` Netlify preview success.
- [x] **PX2.5** Preserve keyboard/focus behavior and skip-to-content accessibility.  
  Evidence: PR #291 / main SHA `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` / browser-regression PASS including skip-link, landmarks, `aria-current` and focus restoration.
- [x] **PX2.6** Remove decorative or duplicated header content that does not help the current task.  
  Evidence: PR #291 / main SHA `1a7974186bd5a9daa7736c17ed0b3ee1149a8aa2` / principal diff review + browser-regression PASS.

### PX3 — People Overview

> **Principal accepted for PX3.1–PX3.9.** Earlier #270 production acceptance covered the authoritative Overview/absence/long-interval slice. Principal SHA `7592fb7f6ba5220b385871f812d03fd17f492bd5` subsequently added the explicit non-PII v1 profile-completeness contract and canonical 14-day `AvailabilityChanged` history projection. Final C6 accepted the integrated composition and preserved fail-closed/partial behavior.

- [x] **PX3.1** Build `/pessoas` People Overview as the default People entry.
- [x] **PX3.2** Add meaningful summary counts derived from real APIs.
- [x] **PX3.3** Build “Precisa da sua atenção” using real actionable conditions.
- [x] **PX3.4** Add profile-incomplete attention condition only if the required-field contract is explicit.
- [x] **PX3.5** Add absence-affects-assignment attention condition.
- [x] **PX3.6** Add eligible-with-long-interval attention condition using explainable operational logic.
- [x] **PX3.7** Add recent-availability-change attention condition if event/history data supports it reliably.
- [x] **PX3.8** Every attention card must link directly to the relevant resolution flow.
- [x] **PX3.9** Implement loading, empty, retryable error and partial-degraded states.

Evidence PX3.1–PX3.9: PR #289/#300/#301 + principal SHA `7592fb7f6ba5220b385871f812d03fd17f492bd5` / issue #270 production evidence + integrated C5/C6 gates / accepted product SHA `f013f72722c18a6df06ad7c6390be668ed239dbf`.

### PX4 — Directory 2.0

- [x] **PX4.1** Build responsive People Directory with desktop table and mobile-friendly list/card composition.
- [x] **PX4.2** Implement fast search.
- [x] **PX4.3** Implement Group filter.
- [x] **PX4.4** Implement Availability filter.
- [x] **PX4.5** Implement Eligibility filter.
- [x] **PX4.6** Implement Responsibility filter.
- [x] **PX4.7** Implement State filter.
- [x] **PX4.8** Keep advanced filters under “Mais” rather than always visible.
- [x] **PX4.9** Make filter state URL/shareable where safe and useful; never put sensitive data in query strings.
- [x] **PX4.10** Add clear empty/no-results state with filter-reset action.
- [x] **PX4.11** Add capability-aware bulk/export actions without cluttering default browsing.
- [x] **PX4.12** Verify 320/375/390/430/tablet/desktop layouts.

Evidence PX4.1–PX4.12: PR #308 (Directory/export hardening) + PR #311 (privacy-safe Directory→Profile route) / quality + browser-regression + canonical Netlify evidence / C6 production responsive/privacy acceptance at `f013f72722c18a6df06ad7c6390be668ed239dbf`.

### PX5 — Unified Person Profile

- [x] **PX5.1** Build profile shell with Summary / Contacts / Participation-Eligibility / Availability / Assignments / Organization / History.
- [x] **PX5.2** Summary shows current status, group, relevant upcoming absence, recent/next assignments and responsibilities without exposing unnecessary PII.
- [ ] **PX5.3** Contacts section supports authorized phone/email/address data with clear editing flow.  
  Remaining gap: the current canonical profile contract does not expose ordinary phone/email/address. The UI deliberately says so and does not fabricate PII; emergency contacts are separate and capability-controlled.
- [ ] **PX5.4** Participation/Eligibility section uses explicit settings and explains what each setting affects.  
  Remaining gap: explicit eligibility decisions are shown safely, but the full product-level explanation of the operational effect of every setting is not yet complete.
- [x] **PX5.5** Availability section integrates away periods into one understandable timeline/list.
- [ ] **PX5.6** Assignments section shows history and upcoming assignments with useful filters.  
  Remaining gap: history/upcoming evidence is present and correctly ordered by resolved instants, but the full set of useful product filters is not complete.
- [x] **PX5.7** Organization section integrates household/service group/responsibilities context without making the user visit separate CRUD pages for normal tasks.
- [x] **PX5.8** History section exposes appropriate audit/history information with least privilege.
- [x] **PX5.9** Add contextual “candidate for upcoming assignment” insight only after recommendation service is ready.

Evidence for completed PX5 items: PR #305 profile foundation + PR #317 C5.7 profile candidate insight / principal temporal/DST corrections / quality + browser-regression + canonical Netlify / C6 exact-SHA acceptance. Unchecked items above remain real contract/UI gaps.

### PX6 — Guided Add/Edit Person

- [x] **PX6.1** Build step 1 Identity.
- [ ] **PX6.2** Build step 2 Contact.  
  Remaining gap: the step exists as an explicit unavailable-contract state, but ordinary phone/email/address cannot be edited until an authorized canonical DTO/API exists.
- [ ] **PX6.3** Build step 3 Organization.  
  Remaining gap: household/service-group organization is implemented, but the target step also requires broader responsibilities coverage not yet present in the canonical wizard contract.
- [ ] **PX6.4** Build step 4 Participation/Eligibility.  
  Remaining gap: explicit eligibility is implemented; dated availability/absence configuration is intentionally not invented and still needs an approved contract/flow.
- [x] **PX6.5** Build step 5 Review and confirm.
- [x] **PX6.6** Distinguish required and optional data.
- [x] **PX6.7** Add safe unsaved-change protection.
- [x] **PX6.8** Guard against double submit.
- [x] **PX6.9** Preserve server-side validation and authoritative tenant/actor/capabilities.
- [x] **PX6.10** Verify persistence after refresh.
- [x] **PX6.11** Add edit flow that reuses the same mental model without forcing unnecessary steps.

Evidence for completed PX6 items: PR #309 corrected guided-editor foundation + PR #312 Directory Add/Edit integration / ambiguous-create, partial-persistence, authoritative refetch, concurrency and double-submit regressions / quality + browser-regression + C6 exact-SHA evidence. PX6.2–PX6.4 remain partial by contract rather than being faked.

### PX7 — Explainable Recommendation Engine

- [x] **PX7.1** Define versioned recommendation input contract in application/domain layer.
- [x] **PX7.2** Define structured recommendation reason codes.
- [x] **PX7.3** Filter explicit ineligible candidates.
- [x] **PX7.4** Filter people away during the relevant meeting.
- [x] **PX7.5** Detect assignment conflicts.
- [x] **PX7.6** Detect existing assignment in the same week/meeting where relevant.
- [x] **PX7.7** Calculate recency/rotation signal without turning it into an opaque score.
- [ ] **PX7.8** Preserve explicit responsibility/manual constraints.  
  Remaining gap: canonical responsibility evidence is honored where available, but the product does not yet have a complete approved manual-exclusion/preference contract; the browser must not invent one.
- [x] **PX7.9** Return ranked candidates plus reasons and warnings.
- [x] **PX7.10** Add “why recommended” and “why not recommended” API/application tests.
- [x] **PX7.11** Add deterministic tie-breaking so repeated calls do not shuffle unexpectedly.
- [x] **PX7.12** Add tenant/capability/security tests for recommendations.
- [x] **PX7.13** Add pt-PT/en/es localized reason text in UI.
- [x] **PX7.14** Build recommendation picker used by assignment workflows.
- [x] **PX7.15** Include “Ver todos os elegíveis” escape hatch so the user remains in control.

Evidence for completed PX7 items: PR #307 backend/domain correction + PR #313 server-side authenticated adapter + PR #314 localized reasons + PR #315 picker + PR #316 all-eligible + PR #317 profile insight integration / deterministic, tenant/capability, hard-constraint and privacy tests / C6 final acceptance at `f013f72722c18a6df06ad7c6390be668ed239dbf`. PX7.8 remains explicitly partial.

### PX8 — Responsible-person assistance

- [ ] **PX8.1** Build affected-assignment-by-absence workflow with direct substitute suggestions.
- [ ] **PX8.2** Build incomplete-meeting assistance with remaining-part count and candidate availability.
- [ ] **PX8.3** Build workload/rotation imbalance insight with alternatives.
- [ ] **PX8.4** Build long-interval candidate insight.
- [ ] **PX8.5** Ensure every insight is dismissible/navigable and does not block normal operation.
- [ ] **PX8.6** Audit all wording to avoid judgmental or spiritual-value language.
- [ ] **PX8.7** Add tests proving insights use explicit operational facts only.

### PX9 — Hourglass People parity, simplified

- [ ] **PX9.1** Transfers: send flow with selected people, confirmation, privacy explanation, status and history.
- [ ] **PX9.2** Transfers: receive flow with secure code/token mechanism appropriate to Eutaktos architecture.
- [ ] **PX9.3** Labels/tags: create/manage/filter without turning labels into permanent navigation clutter.
- [ ] **PX9.4** Reminders: show who needs a reminder, reason and last reminder date before sending.
- [ ] **PX9.5** Record cards/reports: controlled generation with year/period selection and preview.
- [ ] **PX9.6** Archive / “A não publicar”: reason, date, audit history and safe restore.
- [ ] **PX9.7** Import wizard: supported source selection.
- [ ] **PX9.8** Import wizard: preview + validation + duplicate/conflict report.
- [ ] **PX9.9** Import wizard: dry-run and rollback/recovery where supported by current import architecture.
- [ ] **PX9.10** Map: capability-controlled people/group visualization.
- [ ] **PX9.11** Map: group filter/legend and responsive mobile behavior.
- [ ] **PX9.12** Contact list: configurable fields, filters and safe export.
- [ ] **PX9.13** Emergency mode: mobile-first quick access for authorized users.
- [ ] **PX9.14** Emergency mode: family/emergency contacts and organization contacts with least privilege.
- [ ] **PX9.15** CSV export where required.
- [ ] **PX9.16** PDF export where required.
- [ ] **PX9.17** DOCX export only if product need remains after user testing; do not implement solely for competitor parity.

### PX10 — UX quality, accessibility and production acceptance

> C6 independent acceptance provides final evidence for the checked quality items below on the currently integrated People core. It does not claim physical-device testing, a real screen-reader run, zoom evidence, or a write-capable real-user walkthrough that was not executed.

- [x] **PX10.1** No primary People screen begins with unexplained dense data.
- [x] **PX10.2** Light theme visual acceptance complete.
- [x] **PX10.3** Dark theme visual acceptance complete.
- [x] **PX10.4** System theme behavior verified.
- [x] **PX10.5** Keyboard-only People workflow verified.
- [ ] **PX10.6** Screen-reader labels/structure verified for primary flows.  
  Remaining evidence gap: automated semantics/accessibility checks exist, but no real screen-reader acceptance run has been claimed.
- [ ] **PX10.7** 200% zoom verified.
- [ ] **PX10.8** 400% zoom/reflow checked where applicable.
- [x] **PX10.9** 320/375/390/430/tablet/desktop responsive matrix PASS.
- [x] **PX10.10** No horizontal overflow on supported primary screens.
- [x] **PX10.11** Error/loading/empty/retry states exist for every async People surface.
- [x] **PX10.12** Double-click/retry/stale-response ownership tests remain PASS.
- [x] **PX10.13** PWA privacy regression remains PASS.
- [x] **PX10.14** Bundle budget remains within agreed limit after Ant migration.
- [x] **PX10.15** pt-PT/en/es People flows verified for layout and copy.
- [x] **PX10.16** Zero unresolved P0/P1 defects in the rebuilt People experience.
- [ ] **PX10.17** Real-user walkthrough: user can find a person, understand their status, update availability and reach an assignment suggestion without training.  
  Remaining evidence gap: C6 intentionally avoided production writes, so the complete update-availability walkthrough has not been independently executed end to end.
- [ ] **PX10.18** Principal final review confirms People is a reference-quality module before the same patterns are rolled out to the rest of Eutaktos.  
  Remaining product gap: explicit PX5/PX6/PX7.8 gaps plus PX8/PX9 still remain; C6 accepted the integrated People core, not every master-plan capability.

Evidence for checked PX10 items: independent C6 final closure on canonical production plus exact detached SHA `f013f72722c18a6df06ad7c6390be668ed239dbf`; responsive matrix, Light/Dark/System, pt-PT/en/es, keyboard/focus, error/retry, stale/double-submit, PWA/privacy, security boundary and zero-open-defect disposition PASS.

### PX11 — MUI retirement after People reference is proven

- [ ] **PX11.1** Catalogue remaining MUI screens after People rebuild.
- [ ] **PX11.2** Migrate remaining shared shell primitives.
- [ ] **PX11.3** Migrate remaining product screens in priority order using the People patterns.
- [ ] **PX11.4** Remove `@mui/material` only when no runtime consumer remains.
- [ ] **PX11.5** Remove Emotion dependencies only if no other approved consumer remains.
- [ ] **PX11.6** Re-run full quality/browser/PWA/bundle suites after MUI removal.

---

## 12. Recommended execution order

Do not start with every PX9 parity feature at once.

**Wave A — foundation**  
PX0 → PX1 → PX2

**Wave B — People core usability**  
PX3 → PX4 → PX5 → PX6

**Wave C — Eutaktos differentiation**  
PX7 → PX8

**Wave D — Hourglass parity where useful**  
PX9

**Wave E — hardening and expansion**  
PX10 → PX11

Current post-C6 priority: preserve the accepted People core, close only approved canonical-contract gaps, then proceed through PX8/PX9 and the remaining explicit PX10/PX11 evidence/tasks. The principal may parallelize isolated tasks, but no agent should invent a separate UX direction.

---

## 13. Required PR template for Product Experience work

Every Product Experience PR should state:

- **Task ID(s):** PX__
- **Base main SHA:** ___
- **User problem solved:** ___
- **What changed:** ___
- **What intentionally did not change:** ___
- **Capabilities/security impact:** ___
- **PII/privacy impact:** ___
- **Tests added/updated:** ___
- **Quality commands and results:** ___
- **Viewports/themes/locales checked:** ___
- **Screenshots/evidence:** sanitized only
- **Remaining work:** ___

The PR author must not mark the master checkbox complete. The principal does that after integration and verification.

---

## 14. Definition of done for a rebuilt screen

A screen is not done because it “looks modern”. It is done when:

- the primary purpose is obvious;
- the main next action is obvious;
- normal users do not need knowledge of internal domain terminology;
- loading, empty, error and retry states work;
- cancellation and destructive actions are safe;
- duplicate submission is prevented;
- stale async responses cannot overwrite current state;
- data persists after refresh where persistence is expected;
- unauthorized users fail closed;
- pt-PT/en/es are supported;
- light/dark/system work;
- mobile and desktop are intentionally designed;
- keyboard/focus/accessibility behavior is correct;
- tests cover real behavior, not only render snapshots;
- no PII is leaked into logs/URLs/client storage/service-worker caches;
- the principal has reviewed the real code/diff and relevant production behavior.

---

## 15. Decisions that are intentionally deferred

Do not block People 2.0 on these:

- optional extra color palettes beyond excellent light/dark;
- advanced AI/LLM-generated recommendations;
- decorative animation systems;
- DOCX parity if user research shows CSV/PDF is sufficient;
- broad redesign of every module before People proves the pattern.

The first recommendation engine should be deterministic, explainable and domain-driven. Generative AI is not required for the core recommendation experience.

---

## 16. Product success criterion

Before applying this experience to the whole application, People must reach this standard:

> A responsible person opens Eutaktos without training, immediately understands what needs attention, can find or update a person quickly, can see how that person relates to availability/organization/assignments, and receives clear explainable assistance when choosing the next action or a candidate — while remaining fully in control of the decision.

If Eutaktos only reproduces Hourglass functionality with different colors, this plan has failed.

If Eutaktos makes the responsible person's work materially clearer, faster and safer while preserving the operational coverage they need, the People reference module is ready to guide the rest of the product.
