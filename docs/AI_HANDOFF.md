# AI HANDOFF — CURRENT SOURCE OF TRUTH

> Updated 2026-08-22 during project recovery. Read this before taking any Eutaktos task. Historical task reports may contain stale deployment or branch information.

## Canonical project

- Repository: `bfrpaulondev/eutaktos`
- Audited main baseline: `7817833584e3b3b469b1564cf4f9231471b04be1`
- **Canonical production: `https://rainbow-zuccutto-00d981.netlify.app/`**
- Do **not** use `https://eutakes.netlify.app/` or Vercel deployments as Eutaktos production acceptance evidence.
- Full recovery state and triage: `docs/RECOVERY_AUDIT_2026-08-22.md`.

## Current reality

The previous handoff was obsolete: it still described the project as early Phase 1 and pointed to `kimi/organization-service`. Since then the project has integrated reviewed Kimi K03–K40 work, a production API/Supabase runtime foundation, reviewed Manus frontend waves, K41–K50 scheduling/application work and A06 Midweek API/Supabase/PWA integration.

Important reviewed integration PRs include #109, #131, #149, #155, #167, #180 and #181. Do not resurrect their old individual branches as independent unfinished work.

## Current open work

Manus PRs #190–#200 exist, but they are not eleven new features. Recovery triage:

- Review/integrate product candidates: #191, #192, #195.
- Review quality-only candidates: #196, #197, #198.
- #199 must be corrected before merge because its CDP script reintroduces the reload race already fixed by #186.
- #190 and #200 must not be treated as final acceptance because they use/retain evidence from the wrong production target and #200 was run without M55–M59 integrated.
- #193/#194 are evidence/docs to fold into the next consolidated acceptance run rather than count as product delivery.

K51–K60 are **not assigned merely because an issue exists**. No K51–K60 Kimi branches were present at the recovery audit. The user must explicitly send work to the external Kimi agent.

## Definition of done

`ASSIGNED → IN PROGRESS → PR/REVIEW → INTEGRATED MAIN → DEPLOYED RAINBOW → PRODUCTION VERIFIED → DONE`

A branch, commit, agent report, deploy preview or green local test alone is not `DONE`.

## Ownership while recovering

- Principal/integration agent: main integration, runtime/API/Supabase, production verification and cross-cutting fixes.
- Manus: frontend/PWA only, explicitly scoped.
- Kimi: domain/application/in-memory test work only after explicit user assignment.

Do not issue another large task wave until #190–#200 are triaged/integrated and the resulting main is verified on Rainbow.

## Immediate next sequence

1. Consolidate #191/#192/#195, then #196–#198.
2. Repair #199 using the stable CDP navigation/storage approach from #186.
3. Produce one fresh cumulative frontend gate on the consolidated main.
4. Verify root, `/api/health`, `/api/ready`, deep links and authorised pilot E2E on `https://rainbow-zuccutto-00d981.netlify.app/`.
5. Only then explicitly dispatch K51–K60 and resume parallel development.
