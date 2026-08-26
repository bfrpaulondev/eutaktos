# C5.3 People recommendation adapter contract

`GET /api/people/recommendations?meetingId=<opaque-id>&slotId=<opaque-id>`

The browser may select only an existing meeting and slot. It must not provide recommendation facts or authority-bearing values.

Server-derived inputs:

- authenticated tenant and actor;
- authenticated capabilities;
- people in the authenticated tenant;
- explicit eligibility decisions;
- availability periods;
- Midweek meeting/slot and timezone-resolved target window;
- active assignments and same-week workload;
- completed assignment history.

Required capabilities: `people.read`, `eligibility.read`, `availability.read`, `schedule.read`.

Explicitly rejected request fields include tenant/actor/capabilities, assignment type, candidate people and eligibility data. The assignment type is derived from the target slot's stored `partDefinitionId`.

Response contract: `people-recommendation-v1`, carrying target identity/timing plus PX7 structured candidates/exclusions enriched only with the authorized person's display name. No tenant id, actor id, capability set, contact data or other sensitive profile data is returned.

This adapter is read-only and advisory. It never creates or changes an assignment and never makes the final human decision.
