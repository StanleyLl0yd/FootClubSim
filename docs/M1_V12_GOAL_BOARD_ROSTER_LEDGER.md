# M1-P3: one causal match-event view of goals, referee boards and the XI

**19 October 2026 - isolated v12 research adapter. Not a new persisted
career/IndexedDB version, not a complete referee, not a source of empirical
RPL event frequencies.**

Earlier experiments implemented (a) seeded, internally generated goals
and Law 8 kickoff candidates in [v9](M1_V9_GOAL_RESTART_REFEREE.md),
(b) in-game board issuing and immediate normal departures in
[v10](M1_V10_INTERNAL_GOAL_BOARDS.md), and (c) exact playing/paused
wall-time **goal-only** reconstruction in
[v11](M1_V11_GOAL_DUAL_CLOCK.md). They were independent projections.
A correct match simulation must derive active players, shots and referee
transitions from the same authoritative event history.

`src/core/m1-v12-goal-board-roster.ts` now produces a **single
self-contained chronological replay** for the narrow case of
*completed, timely, normal substitutions at internally generated goal
stoppages*. The source of events is the validated
`simulateM1V10WithInternalGoalBoards` output, which in turn reruns
the original v8 match with accepted manager commands and source-derived
goal authorizations. No user-supplied goal/board list is accepted.

For each seed-derived, actual v8 open-play shot, the versioned ledger
stores source shot ID, shooter, team, current XI and exact running
seconds. For a scored goal before the final phase, it emits:

1. The original `source-shot`, while the scorer was on the field.
2. `goal-whistle` at its actual v8 source timestamp.
3. `board-signal` for each internally issued referee signal. Every
   signal is ordered within the same synthetic stopped-wall timeline.
4. `substitution-applied`, **changing the actual XI in the same
   event stream**, not just attaching an advisory label. The incoming
   player must be absent, outgoing present and XI preserved at eleven.
5. `restart-kickoff`, which advances only the synthetic wall clock,
   by a bounded 0..120 seconds. The playing clock does not advance.

Opposing teams can replace players in the same stopped-play window;
board actions are sorted by wall second and stable team order. If
a multi-player signal cannot fit in the configured stopped wall time,
the entire research run returns `STOPPAGE_TOO_SHORT` and emits
**no accepted game**. A fixture cannot acquire a stoppage without
a real internally replayed goal. At the final whistle the independently
replayed final XI and goals are matched to the real v8 simulation.
The versioned ledger is structurally canonical, repeatable and
verifiable through `verifyM1V12GoalBoardRoster`, which rejects altered
snapshots rather than assuming they are authoritative.

Tests cover real seeded opening goal at t=299, deterministic normal
changes, grouped and both-team simultaneous boards, XI presence
before/after legal admission, future shot participants, clock
monotonicity, no-goal substitutions, too-short pauses, arbitrary
source/score/clock manipulation, getters/cycles and original
v8 RNG/final-score parity.

## Critical limitations, and why they are not bypassed

The source **is still the original 300-second phase-based v8 engine**.
The shot events have real v8 phase timestamps but **no continuous
sub-minute ball trajectory** or generated foul, offside, corner,
throw-in, disciplinary card, injury or special-goal probabilities.
Wall-time pause is an explicit synthetic scenario parameter and has
not been calibrated against match footage.

Immediate departures are an *idealized narrow case*, not physical
departure latency calibration. No late-substitute 60-second pending
state is implemented; a truly late departure would make one side play
short and invalidate downstream v8 phase-goal generation unless the
engine regenerates the phase with that actual short-handed XI. This
adapter refuses that case. It does not claim legality of all goal
restart procedures or other IFAB 2026/27 exceptions.

This is a single auditable **timeline projection of a validated v8
run**, not yet a unified live event-driven generator. Remaining
[P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29)
work must implement a source-authoritative whistle/restart clock and
player-presence transition **inside** the shot-generation loop, with
medical/referee exceptions and a common interactive/automatic path.
[P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
requires lawful comparable football data; this ledger creates no
synthetic pass/fail benchmark.

Historical M0, v3-v8 results/saves, and P5 free-only source rights
policy are untouched. M1 exit #3 remains OPEN. M2 is prohibited.
