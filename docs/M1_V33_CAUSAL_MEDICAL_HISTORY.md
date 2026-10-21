# M1 P4: v33 source-replayed causal medical history, read-only

**21 October 2026. Model events only, NOT certified injury, recovery,
disciplinary carryover, chronological scheduling or calibrated fatigue.**

A v32/schema-6 career journal now contains internally generated v29
patient decisions connected to the actual referee whistle, sanctioned
physical incident, temporary exit and return, together with the v31
per-player physical-time accounting. The v33 independent projection
exposes this historical context **without mutating any save**:

`deriveM1V33CausalMedicalHistory(initialCareer, journal)` first
fully validates/replays **every** schema-6 row from the immutable
original career/catalog. It groups player exposure by collision-free
`[teamId, playerId]` identity and sums physical seconds, shots,
modelled cards, synthetic medical departures/returns and substitutions
across fixtures. It exposes the last **posted** fixture and its
final physical XI status, not a verified season chronology.

Each modelled medical assessment yields a separate read-only episode
with journal revision, fixture ID, incident ID, patient, offender
decision, whistle/restart provenance and optional source exit/return
IDs. Per-player on-field/off-field assessment counts and latest
posted episode are reconciled with the full source history. The
historical `on-field-quick` literal is a backwards-compatible model
branch name, **not** the removed 2026/27 IFAB Law 5 quick-treatment
eligibility criterion.

The verifier `verifyM1V33CausalMedicalHistory` reconstructs the
entire view from original M0 career and v32 journal, rejecting
tampered source history, patient attribution, totals, fabricated
medical clearance, reordered episodes and non-plain JSON.

**Hard boundaries:** An internally seeded patient assessment is
NOT a diagnosis, physician authorization or completion of a
certified rehabilitation interval. Synthetic yellow/red card counts
cannot be converted into a league suspension without trusted KDK and
RPL rule evidence. The fixture posting order may not reflect game
calendar dates. Thus the output always reports
`calendarChronologyAuthenticated:false`,
`independentMedicalDiagnosisAuthenticated:false`,
`medicalReturnAndClearanceAuthenticated:false`,
`disciplinaryCarryoverAuthenticated:false`,
`fatigueDeltasCalibrated:false` and
`officialLeaguePointsAwarded:false`.

v33 does not modify schema-6, old schema-5, IndexedDB CAS or M0.
P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN.
M2 prohibited.
