# People Product Experience — current integrated status

> Principal status snapshot updated 2026-08-27 after final PX9.10/PX9.11 People Map review and integration. This file records what is technically present on `main`; it does not convert human assistive-technology or real production-write acceptance into automated evidence.

## Current baseline

- Repository: `bfrpaulondev/eutaktos`.
- Canonical production acceptance target: `https://eutakes.netlify.app/`.
- Current technical People/PX runtime baseline: `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.
- UI foundation: Ant Design 6. Runtime MUI/Emotion dependencies are retired and guarded from reintroduction.
- Tenant, actor and capabilities are server-derived. Browser state is never authoritative for those values.
- **People technical implementation status: COMPLETE.**

## Integrated People Product Experience

### Core People

Technically integrated:

- People Overview with actionable attention states;
- responsive Directory 2.0 with search, filters and capability-aware actions;
- unified Person Profile;
- guided Add/Edit Person flow;
- ordinary Contact through a dedicated least-privilege contract;
- households, service groups and responsibilities context;
- availability/away periods;
- explicit eligibility;
- appropriate audit/history surfaces;
- pt-PT/en/es;
- safe loading/empty/error/retry states;
- stale-response and duplicate-submit protections.

### Explainable recommendations and assistance

PX7.1–PX7.15 and PX8 are technically integrated:

- deterministic candidate ordering;
- explicit eligibility/availability/conflict/history evidence;
- structured reasons/warnings;
- persistent narrow manual exclusions without subjective boost scoring;
- human choice remains final;
- absence-affects-assignment assistance;
- incomplete-meeting attention;
- factual workload/rotation and long-interval assistance;
- no autonomous assignment or spiritual/personal-worth inference.

### PX9 — People parity/product tools

Technically integrated:

- **PX9.1/PX9.2 secure People Transfers** — server-owned persistence, 256-bit URL-safe secret, SHA-256 digest only, 72-hour expiry, one-time atomic claim, same-destination retry idempotency, sender cancellation, no automatic source deletion, new destination Person IDs and minimum-data transfer payload. PR #387; main `550ff297c7937b11ee6be69600df28afb2712ea6`.
- **PX9.3 Labels/tags** — explicit canonical labels with management/filtering and privacy/authority coverage.
- **PX9.4 Reminders** — server-authoritative pending evidence and safe queued send intent semantics.
- **PX9.5 Record Cards / Reports** — purpose-built minimum-data projection with annual/bounded period selection and preview. PR #383; main `e8d25f0e0d36305cc618e94ca1f52d17a5db9157`.
- **PX9.6 Archive / “A não publicar”** — explicit reason/date/history and safe restore.
- **PX9.7/PX9.8/PX9.9 Import** — source/preview/validation/duplicate-conflict analysis plus authenticated prepare → confirm → execute and create-only rollback/recovery.
- **PX9.10/PX9.11 People Map** — privacy-first approximate manual locations, dedicated sensitive capabilities, minimum-data projection, Ant/Leaflet graphical map, semantic equivalent list, group filter/legend and responsive/reflow coverage. PR #392; final reviewed head `ad5b86bf9a40a9c75dafe7495e0ffdbc3b25ddfc`; squash main `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.
- **PX9.12 Contact List** — dedicated least-privilege configurable projection and spreadsheet-safe CSV export.
- **PX9.13/PX9.14 Emergency mode** — mobile-first authorized emergency surface and separate emergency-contact boundary.
- **PX9.15 CSV export** — capability-aware export with formula-injection protection.
- **PX9.16 direct Record Cards PDF** — browser-local binary PDF from the already-authorized Record Cards projection, with no wider DTO or persistence. PR #386; main `dae654390d17cdf76545519910a375ebf3c04ff6`.

### PX9.10/PX9.11 Map authority/privacy details

Final Principal-reviewed behavior:

- read requires server-derived `people.read + map.read`;
- set/remove require server-derived `people.write + map.write`;
- `tenant.manage`, People capabilities alone, Contact access or browser claims do not imply Map authority;
- `map.read` and `map.write` are sensitive capabilities;
- location persistence is tenant-scoped and separate from ordinary Contact;
- coordinates are manually supplied, approximate and normalized server-side to at most two decimals before persistence;
- no Contact-address geocoding, browser/IP/device geolocation or location inference;
- GET Map DTO contains only opaque Person ID, display name and normalized approximate coordinates;
- archived/non-publishable People are excluded;
- audit/outbox evidence excludes coordinate values;
- same-Person mutations are serialized for concurrent retry idempotency;
- tile-provider requests contain no Person/group identity or Contact PII;
- graphical overlays are local;
- equivalent semantic list and keyboard selection are provided;
- group filter/legend uses the existing authorized service-group projection locally and does not widen `people-map-v1`;
- pt-PT/en/es plus 320/375/390/430/640/768/1024/1280/1440 responsive/reflow coverage are included.

Final PR #392 exact-head evidence:

- final head `ad5b86bf9a40a9c75dafe7495e0ffdbc3b25ddfc`;
- GitHub Actions run `33115570822` / #986;
- `quality`: PASS;
- `browser-regression`: PASS;
- canonical `netlify/eutakes/deploy-preview`: PASS;
- Vercel rate-limit failures: NON-GATING.

### PX9.17 DOCX

**DEFERRED / NOT REQUIRED** for People technical completion.

CSV + PDF satisfy the currently approved export needs. DOCX must only be added if later user/product evidence establishes a real need. See `docs/PEOPLE_DOCX_EXPORT_DECISION.md`.

## PX10 — technical quality/accessibility evidence

Technically automated/integrated:

- responsive mobile/tablet/desktop gates;
- keyboard/focus semantics covered by automated runtime where tooling permits;
- Light/Dark/System and pt-PT/en/es regression coverage;
- PWA privacy gate;
- bundle gate;
- permanent 200% desktop zoom-equivalent People reflow at 640 CSS px;
- permanent 400% desktop zoom-equivalent People reflow at 320 CSS px;
- People Map adds its own 320–1440 matrix and equivalent reflow checks;
- zero known unresolved P0/P1 People technical defects at final closeout.

Not automatically proven:

- real screen-reader acceptance;
- write-capable real-user production walkthrough with approved disposable/real data;
- physical-device evidence where explicitly required.

These are human acceptance activities, not missing People code.

## PX11 — Ant Design migration / MUI retirement

Technically complete:

- Ant Design 6 is authoritative for product UI;
- remaining shared/runtime surfaces migrated;
- MUI/Emotion runtime dependencies removed;
- guard prevents accidental runtime reintroduction;
- quality/browser/PWA/bundle gates remain green.

## Final technical verdict

**Remaining approved People product/runtime implementation: NONE.**

People is now the reference-quality technical module for the next Product Experience phase. The recommended next target is **Organization 2.0**, reusing the People Ant Design patterns and existing household/service-group/responsibility contracts rather than creating parallel models.

Human real-screen-reader and production-write acceptance remain explicitly separate and must not be fabricated as automated PASS.
