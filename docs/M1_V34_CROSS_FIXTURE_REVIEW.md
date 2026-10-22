# M1 P4: v34 round-ordered source evidence review

**22 October 2026. Isolated read-only schema-6 projection; not medical
clearance, a disciplinary suspension engine, or authenticated eligibility.**

`deriveM1V34CrossFixtureReview(initialCareer, journal)` validates and
**fully replays every v32/schema-6 journal row** before projecting cross-fixture
evidence. It orders validated synthetic fixtures by **round and fixture ID**,
not by CAS posting revision, then extracts actual modelled permanent-injury
withdrawal, second-yellow dismissal and straight-red dismissal counts from
the source-derived v31 physical-player rows.

For any **later synthetic round**, if the same [teamId, playerId] actually
has positive physical playing time, the projection links that appearance
to the most recent earlier withdrawal and/or dismissal. Evidence from the
same fixture never counts as a subsequent appearance. Per-observation
`postedRevision` is preserved independently of fixture round; an
out-of-order posting cannot invert history. Composite identity keys avoid
cross-club player collisions.

The read-only verifier `verifyM1V34CrossFixtureReview` independently
reconstructs the view and rejects forged source facts, event counts,
chronology, identity, external authority claims, inherited old-schema
journals and non-plain candidate JSON. Seeded tests cover subsequent
actual physical participation following a modelled dismissal or
withdrawal, reverse posting order, source corruption and spoofing.

**Strict limitations:**

- The rounds come from FootClubSim's *synthetic* round-robin fixture
  generator. They do not constitute an authenticated official calendar.
- Modelled withdrawals are not clinical diagnoses. A subsequent match
  appearance is not evidence that a physician cleared a player.
- Modelled dismissals and cautions do not themselves establish KDK
  disciplinary sanctions, their length or their enforcement date.
- Only **positive physical participation** can be observed through the
  stored v31 exposure rows. Unused bench entries, official roster
  registration and external referee/medical attestations are not
  authenticated by this projection.
- Historical signals are not automatically converted to fatigue
  deltas, injuries, suspensions, forfeits, official points or eligibility.

The output therefore explicitly retains
`officialCalendarAuthenticated:false`,
`medicalDiagnosisOrClearanceAuthenticated:false`,
`disciplinarySanctionsAuthenticated:false`,
`playerEligibilityVerified:false` and `fatigueCalibrated:false`.

This does not change v32/schema-6 CAS, v33 player medical history,
v26/schema-5, v8, v7 or M0 saved data. No migration or new storage is
introduced. P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN.
M2 remains prohibited.
