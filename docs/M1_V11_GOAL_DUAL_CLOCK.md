# M1 P3 - exact-second dual-clock goal-whistle replay

**Research-only event schema v11 (19 October 2026).** This does not
replace old v8 persisted saves, is not a complete referee, and does not
calibrate observed football rates or the duration of stoppages.

## Problem and narrow implemented solution

The prior [v10 internal-board adapter](M1_V10_INTERNAL_GOAL_BOARDS.md)
recognizes internally generated goal-restart candidates at coarse
300-second command checkpoints but has no independent playing-time
and stopped-wall-time timeline. The [IFAB 2026/27 Law 8](https://www.theifab.com/laws/latest/the-start-and-restart-of-play/)
requires a kick-off to restart play after a goal, while
[Law 3's time-limited substitution protocol](https://www.theifab.com/laws/latest/time-limited-substitution-protocol/)
distinguishes the ten-second wall-clock exit requirement from sixty
seconds of **running match time** after play restarts for a late
replacement's eventual admission. These clocks must not be conflated.

The new isolated source `src/core/m1-v11-goal-clock.ts` implements an
event-source-replayed **dual clock**:

- The same unmodified v8 simulator is run from the complete prematch
  and team policy with **no external referee/adjudication source**.
- Each internally calculated open-play shot whose outcome is `goal`
  becomes a `goal-whistle` at its actual v8 phase-end running second
  (299, 599, 899, ...). At that **same playing second**, a
  `restart-kickoff` advances only a separate synthetic wall clock
  by a bounded `pauseWallSeconds` of 0..120.
- While the match is running, the wall clock advances by the same exact
  second count as the playing clock. No artificial five-minute quantum
  is added to the stoppage duration.
- Match-end still occurs at 5400 source-engine playing seconds. A
  last-phase goal at 5399 is not used to claim a later normal
  substitution window, as the actual final-whistle decision and added
  time are not modelled.
- Interactive `startM1V11GoalClock` + repeated
  `advanceM1V11GoalClock(prematch, policy, snapshot, expectedPauseWallSeconds)`
  and full automatic `runM1V11GoalClock` share the same
  replay-verified transition. The **expected pause policy must come from
  the original immutable scenario configuration**, never the untrusted
  saved snapshot. The validator rejects a changed saved pause even if
  its fabricated wall-time history would be internally consistent.
  Every snapshot is structurally validated, replayed against the v8
  source and compared exactly before its next step. Forged goal, times,
  team/fixture, changed seed, duplicates, getters, cycles or impossible
  state are refused.
- The bounded result includes a precise running second, wall second,
  match-event ID, source goal ID and scoring team, all separated from
  the original v8 report and any existing browser/CAS journal.

### Critical limitations

`pauseWallSeconds` is a caller-chosen **synthetic test parameter**,
*not* a historically calibrated physical wait. The caller must retain
its original value separately from save data. A malicious caller who
controls **both** the immutable scenario input and its expected policy
can of course create an entirely different scenario; this pure
research API does not provide cryptographic source authentication. It is **not** accepted
as a referee exception, permission to substitute, real-world
kick-off certification, or evidence of a particular boundary crossing.
This first dual clock has goal stops only, does not generate fouls,
cards, penalty/own-goal referrals, throw-ins, injuries, or any extra
normal-substitution window. The v8 open-play engine still calculates
shots at phase endpoints; the new layer adds second-addressable
stoppages but does **not** retroactively claim a continuous physical
football trajectory. Extra time and legitimate non-goal restarts
require subsequent dedicated work.

The next integration target is an actual in-game **late-substitution
pending state**: once a player misses the Law 3 ten-second deadline,
they leave regardless; the incoming substitute cannot immediately
enter, the team plays short after the restart, 60 full seconds of
running play pass, then the substitute may enter at the *first
following stoppage* only on the referee's signal. That functionality
must update the *same* active-XI event engine, not just a separate
protocol status. No exemption is inferred without a rules-compliant
referee decision.

Tests check a real deterministic goal at second 299, exact
playing/wall-clock separation, source event correspondence for
multiple real seeds, auto-versus-interactive parity, tampered save
rejection, no new goalkeeper claims and bounded pause values.

P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31) and M1
exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3) stay
OPEN. M2 is forbidden. Approved M0 and historical v3-v8
saved careers are untouched.
