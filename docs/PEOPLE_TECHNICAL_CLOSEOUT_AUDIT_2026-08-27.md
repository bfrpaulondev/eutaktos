# People technical closeout audit — 2026-08-27

> Final technical runtime baseline: `main` `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.
> Canonical production acceptance target: `https://eutakes.netlify.app/`.

## Verdict

**PEOPLE IS TECHNICALLY COMPLETE.**

There is no remaining approved People product/runtime implementation slice after integration of PX9.10/PX9.11 People Map. PX9.17 DOCX remains deliberately **DEFERRED / NOT REQUIRED** and is not a technical blocker.

Real screen-reader acceptance and write-capable real-user production walkthrough remain separate human acceptance activities. They are not represented as automated or technically complete by this document.

## Integrated technical scope

The `743a7d7d...` main ancestry includes the reviewed People product/runtime work for:

- People Overview and Directory 2.0;
- unified Person Profile;
- guided Add/Edit Person;
- ordinary Contact with least-privilege boundaries;
- households, service groups and responsibilities context;
- availability and explicit eligibility;
- deterministic explainable recommendations and persistent manual exclusions;
- responsible-person assistance;
- Labels/tags;
- Reminders;
- Archive / “A não publicar”;
- Hourglass import source/preview plus authenticated prepare → confirm → execute and create-only rollback;
- configurable Contact List;
- emergency mode/emergency contacts;
- CSV export;
- Record Cards/reports;
- direct Record Cards PDF export;
- secure People Transfers;
- PX9.10/PX9.11 privacy-first People Map;
- Ant Design 6 migration and MUI/Emotion runtime retirement;
- automated responsive/keyboard/privacy and 200%/400% People reflow coverage;
- stabilized Person Profile browser refresh regression.

## PX9.10/PX9.11 People Map final evidence

PR #392 was independently reviewed and corrected by the Principal before integration.

Worker submitted head: `35348bf4823d496ee59e994b110a8e0c8c204106`.

Principal-reviewed final PR head: `ad5b86bf9a40a9c75dafe7495e0ffdbc3b25ddfc`.

Squash merge/main runtime SHA: `743a7d7d3017aa4cf81a783b2e8bdcb1db241aac`.

Final exact-head gates:

- GitHub Actions run `33115570822` / run #986;
- `quality`: PASS;
- `browser-regression`: PASS;
- canonical `netlify/eutakes/deploy-preview`: PASS;
- noncanonical rainbow preview: PASS;
- Vercel rate-limit statuses: NON-GATING.

Principal corrections made before merge:

1. mutation authorization was corrected from `map.write` alone to the canonical `people.write + map.write` boundary;
2. PX9.11 group filter/legend was completed using the already-authorized Service Group projection, without widening the `people-map-v1` DTO;
3. same-Person set/remove database mutations were serialized to preserve idempotent retry semantics under concurrency;
4. browser runtime coverage was expanded for the dual write gate, group filter/legend and 320/375/390/430/640/768/1024/1280/1440 reflow matrix;
5. the Ant Select test interaction was hardened without weakening product assertions.

The resulting Map contract preserves:

- server-derived tenant, actor and capabilities;
- `people.read + map.read` for read;
- `people.write + map.write` for set/remove;
- `tenant.manage` does not imply Map access;
- dedicated sensitive `map.read` and `map.write` capabilities;
- tenant-scoped separate location persistence;
- explicit manual approximate locations only;
- server-side maximum two-decimal normalization before persistence;
- no automatic Contact-address geocoding;
- no browser/IP/device geolocation;
- no location inference;
- minimum-data GET DTO;
- archived/non-publishable exclusion;
- audit/outbox evidence without coordinates;
- no browser persistence of Person coordinates;
- no Person/group identity in tile-provider requests;
- local graphical overlays;
- semantic equivalent list;
- group filter/legend;
- keyboard selection;
- pt-PT/en/es;
- stale-response and double-submit protection;
- mobile/desktop plus 200%/400% equivalent reflow coverage.

## PX9.17 DOCX

PX9.17 is **DEFERRED / NOT REQUIRED** for People technical closeout.

The detailed decision is in `docs/PEOPLE_DOCX_EXPORT_DECISION.md`.

CSV and PDF satisfy the currently approved People export needs. DOCX is added only if later product/user evidence establishes a concrete need. It must not be implemented solely for competitor parity.

## Historical branch hygiene

Historical `principal/px9-*` branches are not evidence of unfinished product work.

In particular, `principal/px9-people-map` is **HISTORICAL / QUARANTINED** because it predates the approved Map contract and contains incompatible capability/precision concepts. It must never be treated as authoritative.

## Human acceptance boundary

The following remain intentionally outside technical-completion claims:

- real screen-reader acceptance;
- write-capable real-user production walkthrough using approved disposable/real data;
- physical-device evidence where an acceptance item explicitly requires an actual device.

These are acceptance evidence tasks, not missing code.

## Final technical status

**Remaining People technical implementation: NONE.**

**Unresolved known People P0/P1 technical defects: 0 at the reviewed closeout baseline.**

The People reference module can now be used as the Ant Design 6 product-quality pattern for the next Eutaktos module. The recommended next product-experience target is Organization 2.0, reusing People contracts and interaction patterns instead of rebuilding parallel models.
