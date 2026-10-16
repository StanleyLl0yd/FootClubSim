# M1 P4: v8 medical-aware scoring attribution

**Status: experimental, synthetic, not M1 acceptance.** The isolated module
`src/core/m1-v8-goal-attribution.ts` derives a new schema-1, read-only
player goal/shot attribution for medical-aware engine 7, event schema 8.
It independently recomputes the match using the trusted initial input, seed,
commands, medical actions and referee-confirmed decisions before examining
event-derived scoring and physical participation.

Individual rows include open-play shots, pre-outcome xG, on-target shots,
successful/unsuccessful penalty attempts, scored goals and defending own goals.
A defending own goal does **not** fabricate a scorer for the benefiting club.
Penalty xG is **not** inferred: team `xgCoverage` remains `open-play-only`.
A temporary off-field player cannot receive an open-play or special-goal
attribution until a validated return. Row-level sums and sorted physical
final-XI snapshots are reconciled with the v8 report and event stream.

**Boundaries:** this is not a full appearance/disciplinary timeline, condition
or fatigue posting, referee authentication, statutory match sheet, trusted
persistent v8 career CAS, interruption/resumption or legal 2026/27 complete
sanctions procedure. It does not infer a real match's scores from synthetic
rules or declare statistically calibrated football.

M0/v3-v7 events, stored journals, synthetic catalog, approved personnel and
release licensing remain unchanged. M1-P3 #29, P4 #30, P5 #31 and exit #3
remain open. M2 requires independent owner acceptance.
