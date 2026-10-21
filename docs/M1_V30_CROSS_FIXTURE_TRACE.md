# M1 P4: v30 source-replayed cross-fixture exposure trace

**21 October 2026. Read-only, posting-order projection. Not an
authenticated season-long fitness, disciplinary or medical state.**

`deriveM1V30CareerTrace(initialCareer, journalCandidate)` accepts only
the existing complete v26/schema-5 journal after `validateM1V26ExposureJournal`
has verified the original M0 career and **replayed every stored match source**
and all stored exposure facts. Invalid historical rows fail closed.

The projection is grouped by **(team ID, player ID)**, not player display
name. It adds each source-verified player's physical seconds, shots, goals,
first yellow cautions, second-yellow and straight-red removals, permanent
in-match injury withdrawals, temporary exits/returns and substitutions,
and counts the number of journal fixtures in which the player had a
record. It preserves the most recently **posted** fixture and the player's
final on-field status for that fixture, even when a late substitute has
zero playing seconds.

The journal's revision order is **not proven fixture chronology**: the
current schema permits legitimate out-of-calendar posting, and no
season scheduling/fatigue or card-carryover transition is inferred.
In-match synthetic card counts are not official suspensions; modelled
injury withdrawals and temporary treatment are not verified diagnoses
or approvals to return in a later fixture. The output always marks
`calendarChronologyAuthenticated`,
`medicalDiagnosisAuthenticated`,
`disciplinaryCarryoverAuthenticated`,
`fatigueDeltasCalibrated` and
`officialLeaguePointsAwarded` **false**.

`verifyM1V30CareerTrace` recreates the complete view from the original
journal and rejects edited cumulative totals, reordered players, new
authority claims, poisoned historical data, accessors and invalid JSON.
Source event timestamps are not exposed as an authenticated third-party
medical stream.

This is another P4 increment only, compatible with M0 and v26 schema-5.
The separate v26 browser CAS remains authoritative for durable model
history; this v30 projection neither changes persisted formats nor
mutates saves. Legal/certified cross-fixture sanctions, athlete condition,
calibrated fatigue, clinical recovery, full season lifecycle and final
M1 acceptance remain pending. P4 #30 and exit #3 remain OPEN, M2 forbidden.
