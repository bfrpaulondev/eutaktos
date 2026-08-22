# Eutaktos Recovery Audit — 2026-08-22

This document is the operational source of truth for recovery/consolidation. It exists because multiple agents, deployments, stale branches and historical audit documents created ambiguity about what was actually integrated and what was actually production-tested.

## Canonical repository and production

- Repository: `bfrpaulondev/eutaktos`
- Current audited `main`: `7817833584e3b3b469b1564cf4f9231471b04be1`
- **Canonical production URL: `https://rainbow-zuccutto-00d981.netlify.app/`**
- `https://eutakes.netlify.app/` is **not** the canonical production URL.
- Vercel deployments (`eutaktos`, `eutaktos-uxwm`, `fieldpilot`) are not Eutaktos production acceptance gates.
- A GitHub/Netlify deploy preview is evidence for that branch only; it is not evidence that canonical production is updated.

### Critical correction

`docs/M50_FINAL_V1_ACCEPTANCE.md` currently identifies `eutakes.netlify.app` as canonical. That is incorrect. Any production conclusions based specifically on `eutakes.netlify.app` must be treated as historical/non-canonical evidence and re-run against the Rainbow URL before being accepted.

Direct production verification from the recovery agent environment was unavailable because the environment could not resolve the Netlify hostname. Therefore this audit does **not** invent a current Rainbow runtime result. Canonical production status remains `NEEDS DIRECT VERIFICATION` until observed from an environment that can reach it.

## What is actually integrated in main

### Confirmed reviewed integrations

- Kimi K03–K20: integrated/rebuilt by PR #109.
- Kimi K21–K40: integrated/rebuilt by PR #131.
- Production runtime foundation A01–A05/A07–A10: PR #149.
- Manus frontend M41–M49: reviewed integration PR #167.
- K41–K50 scheduling/application wave: reviewed integration PR #180.
- A06 Midweek runtime/API/Supabase/PWA integration: PR #181.
- K47 notification fail-closed hardening and later Netlify/browser corrections are present in the current main history.

Old individual Kimi/Manus branches covered by these integration PRs are not independent unfinished product work. They are stale/superseded branches unless a later audit proves otherwise.

## Functional reality of current main

| Area | Code in main | Production-ready on Rainbow |
|---|---|---|
| PWA shell/navigation/preferences/i18n/a11y baseline | Yes | Needs direct Rainbow verification |
| People directory | UI + application + transport + runtime/persistence present | Needs authenticated Rainbow verification |
| Households / Service Groups / Responsibilities | UI + application + transport + runtime/persistence present | Needs authenticated Rainbow verification |
| Access Management / Audit History | UI + server runtime paths present | Needs authenticated Rainbow verification |
| Midweek Agenda / Assignments | Domain + application + API + Supabase adapter + PWA present | Needs authenticated Rainbow E2E verification |
| Weekend meetings / Public Talks | Significant domain/application code present | **Not fully connected as production PWA/runtime workflow** |
| Duties | Domain/application lifecycle present | **Not fully connected as production PWA/runtime workflow** |
| Publisher assignment responses | Domain/application workflow present | **Not fully exposed as complete production user flow** |
| Notifications | Consent/pending intent/outbox safety present | External provider delivery not proven |
| Migration/import/export | Canonical schema/parser/preview/log/rollback and Hourglass safety work present | Complete production import/export workflow is not yet proven |
| Smart Assign / fairness product | Roadmap/domain foundations only | Not a complete production feature |
| Field service / territories / secretary / extended operations | Roadmap EPICs | Not implemented as complete production features |

## Open Manus PR triage (#190–#200)

| PR | Type | Recovery decision |
|---|---|---|
| #190 M50 | Documentation/audit | **DO NOT MERGE AS-IS** — audited the wrong production URL (`eutakes`) |
| #191 M51 | Product code | **KEEP / REVIEW FOR INTEGRATION** — stale Midweek request protection |
| #192 M52 | Product code | **KEEP / REVIEW FOR INTEGRATION** — accessibility description/live status |
| #193 M53 | Documentation | **FOLD INTO CONSOLIDATED FINAL AUDIT**; no standalone product value |
| #194 M54 | Documentation | **FOLD/RE-RUN**; readiness conclusion is based on non-canonical production evidence |
| #195 M55 | Product code | **KEEP / REVIEW FOR INTEGRATION** — honest offline status |
| #196 M56 | Quality gate | **KEEP / REVIEW** — tighter bundle budget, no product behavior change |
| #197 M57 | Quality gate | **KEEP / REVIEW** — privacy regression guard |
| #198 M58 | Quality gate | **KEEP / REVIEW** — navigation regression coverage |
| #199 M59 | Quality gate | **DO NOT MERGE AS-IS** — its CDP script reintroduces `Runtime.evaluate(... location.reload())`, the browser-navigation race already removed by PR #186 |
| #200 M60 | Documentation/gate | **DO NOT MERGE AS FINAL GATE** — it intentionally did not contain M55–M59 and relies on the old readiness evidence |

Only #191, #192 and #195 materially change user-visible/product runtime behavior. #196–#199 are quality/test work. #190/#193/#194/#200 are documentation/evidence. Therefore counting these 11 PRs as 11 delivered features is misleading.

## Kimi status

The GitHub issue describing K51–K60 is only a queue definition. It is **not evidence that Kimi received the instructions**.

At this audit there are no `kimi/v1-k51-*` through `kimi/v1-k60-*` branches. K51–K60 must be considered **NOT ASSIGNED / NOT STARTED** until the user explicitly sends the queue to Kimi and Kimi publishes work.

Existing old Kimi branches such as K03–K20 and K24–K40 are superseded by reviewed integrations #109/#131 and should not be merged individually.

## Branch cleanup policy

Do not delete a branch until its work is confirmed merged/superseded, but treat the following classes as cleanup candidates:

- `kimi/k03-*` through `kimi/k20-*` → superseded by #109.
- `kimi/k21-*` through `kimi/k40-*` that remain → superseded by #131.
- `kimi/organization-service` → historical/superseded; do not use as current handoff.
- Manus M31–M40 branches → superseded by reviewed integration #155.
- Manus M41–M49 branches → superseded by reviewed integration #167.
- Manus M50–M60 → keep only until the recovery triage above is resolved.

## Definition of done from now on

A task is not `DONE` because an agent says it is finished or because a PR exists.

`ASSIGNED → IN PROGRESS → PR/REVIEW → INTEGRATED MAIN → DEPLOYED RAINBOW → PRODUCTION VERIFIED → DONE`

If any step is missing, the task is not done.

## Three-developer ownership

Until the current backlog is consolidated, do not create another large parallel wave.

- Principal/integration agent: main integration, runtime/API/Supabase, production verification, cross-cutting fixes.
- Manus: frontend/PWA-only tasks that do not modify domain/runtime/Supabase/hosting.
- Kimi: domain/application/in-memory test work explicitly assigned by the user; no assumption that a GitHub issue has been delivered to the external agent.

Every new queue must identify exclusive files/scope and a merge order before work starts.

## Immediate recovery sequence

1. Make this recovery document and the refreshed AI handoff authoritative.
2. Stop using `eutakes.netlify.app` as Eutaktos production evidence.
3. Review/integrate #191, #192 and #195 first because they are small product changes.
4. Review #196–#198 as quality-only changes.
5. Repair #199 before any integration so it uses the stable CDP navigation/storage pattern from #186.
6. Do not merge #190/#200 as acceptance truth; produce a new consolidated acceptance run after the code PRs are integrated.
7. Verify the resulting `main` on `https://rainbow-zuccutto-00d981.netlify.app/`, including `/api/health`, `/api/ready`, deep links and authenticated pilot flows.
8. Only after that, explicitly send K51–K60 to Kimi and resume parallel feature development.

## Current recovery verdict

There is substantial code in the repository, including real runtime/persistence and Midweek integration, so the project is not “almost empty” at code level. The real failure is that branch/agent/deployment coordination has allowed delivered code, quality work and documentation to be counted together while canonical production verification lagged behind.

The next objective is not more task volume. It is to turn the existing code into one verified Rainbow deployment and then resume feature throughput from a clean baseline.
