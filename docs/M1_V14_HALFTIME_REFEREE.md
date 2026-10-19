# M1 P3: deterministic half-time as a lawful internal referee stoppage

**19 October 2026 - isolated v14 research adapter (NOT a persisted
v14 career match, NOT full P3 acceptance).**

[IFAB 2026/27 Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/)
establishes two 45-minute periods with a half-time interval no longer
than 15 minutes. The competition specifies its duration; this bounded
research adapter accepts `0..900` stopped-wall seconds and does NOT
claim that every integer interval is the real RPL default. A change
requires a nonzero synthetic interval.

[Law 3](https://www.theifab.com/laws/latest/the-players/)
authorizes normal substitutions in the half-time interval **without
using one of the three in-play substitution opportunities**, while
the match's competition-specific maximum of five normal changes still
applies. The ordinary substitution procedure must be completed before
the second half starts.

The previous [v12](M1_V12_GOAL_BOARD_ROSTER_LEDGER.md) only accepted
substitutions following internally seeded goals. Half-time is different:
its existence requires no RNG goal or external referee authorisation.

`src/core/m1-v14-halftime-referee.ts` now:

1. Strictly validates JSON source inputs and allows only
   `substitute-normal` commands at exactly **2700 running seconds**
   with `stoppage:'half-time'`. The original v8 match engine verifies
   manager/staff authority, bench/playing-XI eligibility, unique
   identities, foreigner limits and maximum five normal changes.
2. Generates a *source-independent, lawful* `half-time-whistle` at
   2700, with actual original 11-player lineups.
3. Applies the v8-confirmed changes **to the physical XI** during the
   interval as `half-time-substitution` events, with both teams'
   lineup snapshots and zero additional in-play window usage.
4. Records `second-half-kickoff` at the same running second but after
   the separately measured synthetic stopped-wall interval.
5. Replays source shots using the active original and post-change XI,
   preserving the identical original v8 seeded score and RNG state.
   Non-participant shots, forged event claims, wrong actor/team and
   tampered final lineups are refused.
6. Supports no-commands/no-shots halves, a 0-second synthetic interval
   without substitutions and bounded 1..900-second intervals for
   ordinary half-time changes. It does **not** add unexplained fouls,
   goals, cards or medical outcomes.

This step adds a second deterministic class of internally generated
referee stoppage, alongside seeded goal whistles. It does NOT imply
arbitrary client-driven in-play restarts are valid and does not
rewrite the legacy persistent v3-v8 career or engine. Half-time
administrative physical completion is idealized, and
`refereePhysicalProcedureAuthenticated:false` warns against using
the event history as proof of actual referee gestures or real-world
physical timings.

P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29)
still needs full authoritative phase-by-phase in-game referee states,
fouls, cards, penalties, injuries, VAR/keeper exceptions and an
integrated late-entry 60-running-seconds path with **recomputed
short-handed phase shots**. Those future events must be generated from
a single source rather than externally asserted restarts. No changes
to free-only P5 policies, M0 accepted data or existing saved journals.
M1 exit #3 OPEN; M2 prohibited.
