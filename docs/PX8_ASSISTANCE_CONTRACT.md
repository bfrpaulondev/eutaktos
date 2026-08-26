# PX8 People assistance contract

This document defines the PX8 operational-assistance boundary. The feature is deliberately advisory and read-only. It does not create, replace, publish, remove, or otherwise mutate a designation.

## Canonical endpoint

`GET /api/people/assistance`

Response contract version: `people-assistance-v1`.

Authority is resolved from the verified server session. The browser never supplies tenant, actor, capabilities, eligibility, availability, assignment history, workload, or ranking facts.

The endpoint requires server-derived `people.read`. Individual evidence sections become explicitly `unavailable` when their additional read capabilities are absent; they are never converted into factual zero counts.

## Evidence surfaces

| Surface | Canonical facts | Behavior |
| --- | --- | --- |
| Affected assignment | Existing assigned scheduling windows + explicit dated availability | Identifies a designation affected by an absence. For a primary student assignment, direct alternatives may reuse the canonical PX7 recommendation contract. Other assignment kinds remain `suggestionStatus: unavailable` until a role-correct replacement contract exists. |
| Incomplete meeting | Future draft/published meeting slots with explicit `partDefinitionId` + canonical PX7 candidate evidence | Shows remaining unassigned student-capable parts and how many currently have eligible/available candidates. |
| Weekly distribution | Canonical PX7 `sameWeekAssignmentCount` among candidates that already passed hard constraints | Shows only factual same-week workload differences and the count of eligible alternatives with a lower weekly load. It does not label a person as overused or underused. |
| Long interval | Canonical PX7 `LONGER_SINCE_LAST_ASSIGNMENT` reason + completed-history days | Shows the factual number of days since a candidate's last completed assignment when the canonical comparison identifies a relatively longer interval. |

## Human-control boundary

- Assistance cards are dismissible and non-blocking.
- Navigation may take the user to the existing Assignments workspace, but no mutation is performed automatically.
- Candidate ordering is produced by the existing server-side PX7 deterministic recommendation logic; PX8 adds no browser-side scoring.
- Wording must describe operational facts only. It must not imply spiritual standing, personal worth, reliability, merit, or suitability beyond the explicit scheduling constraints.
- A missing capability, missing role-correct substitution contract, or unavailable evidence is shown as unavailable rather than inferred.

## Privacy

The endpoint is same-origin and authenticated. Person display names may appear only in the authorized JSON response and rendered session UI. Assistance values are not placed in query parameters, router state, local/session storage, service-worker cache, audit changed-values, or domain-event payloads by this feature.

## PX7.8 dependency

PX7.8 manual exclusions/preferences remain blocked until there is an approved canonical persistence/domain contract. PX8 must not invent such constraints in browser state and must not claim that they influenced recommendations.

## Production acceptance

Automated quality, browser regression, and canonical Netlify preview validation may be used for this feature. Real-user production scenarios that require write-capable or destructive data remain deferred to `docs/PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md` / PX10.17 and must not be fabricated.
