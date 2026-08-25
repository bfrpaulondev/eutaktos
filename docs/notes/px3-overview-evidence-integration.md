# PX3 People Overview evidence integration

This principal integration connects the reviewed PX7 evidence contract to People Overview without moving domain rules into the browser.

- `/api/people/overview-evidence` derives tenant, actor and capabilities from the authenticated server session.
- The endpoint returns only minimized aggregate evidence for affected active assignments and relative long-interval candidates.
- Missing capability for a subcondition is represented as `unavailable`, not zero.
- Profile completeness and recent availability changes remain explicitly blocked because the authoritative contracts do not yet exist.
- The PWA consumes the versioned evidence response and keeps People/group counts independently degradable.
- The legacy pure summary helper remains only as regression coverage for the previous availability/date semantics; runtime attention logic is server-owned.
