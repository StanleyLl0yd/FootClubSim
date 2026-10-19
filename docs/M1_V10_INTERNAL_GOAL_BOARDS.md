# M1-P3: virtual referee issues its own normal-substitution boards

**19 October 2026. Experimental v10 *entrypoint*, NOT persisted v10,
NOT general referee AI, NOT an approved full M1 simulation.**

## New capability

The preceding [v9 goal-restart admission](M1_V9_GOAL_RESTART_REFEREE.md)
checks that an in-play normal substitution at a 300-second checkpoint
corresponds to an actual goal event generated at the previous v8 phase end.
However, its single/group time-limited departure evidence still came
from caller-owned timestamps and arbitrary referee IDs.

`src/core/m1-v10-internal-referee-boards.ts` now issues that **subset
of referee procedure inside the fictional engine itself**:

1. Freeze strictly validated JSON premises, commands, recorded medical
   actions and decision sources before any calculation.
2. Run the same original deterministic v8 match engine. A goal at virtual
   game time t=299 produces a permitted Law 8 kick-off candidate at t=300.
   If a scheduled substitution's checkpoint lacks such a goal, no internal
   referee board is issued and the whole research-only execution fails.
3. At a goal restart, process each team's requested, otherwise legal
   normal replacement(s). Internally issue unique board/signal IDs.
   There are no client-supplied board IDs, stop IDs or timing dossiers.
4. Use a **zero-delay idealized departure** policy: for a group of 2..5,
   all earlier board signals are issued in virtual *paused-wall* second
   0,1,...,N-1; all departing players leave on the final board second.
   This simulates timely exit WITHOUT asserting that real physical
   substitutes universally leave instantaneously.
5. Pass those internally generated claims into the established Law 3
   single/group IFAB 10-second validator, then the new internally
   verified Law 8 goal-stop gate and unchanged v8 simulation.
6. Assert bitwise-equivalent **semantic result replay** to the original
   v8 run. Neither RNG state nor saved career/journal schema changes.

Both sides may make their normal replacements at the same valid restart,
with one independent window per team. The output is explicitly labelled
`INTERNAL_GOAL_BOARD_INSTANT_DEPARTURE_PROTOTYPE`, with:
`clientRefereeClaimsAccepted:false`,
`physicalExitTimeCalibrated:false` and
`otherRestartTypesGenerated:false`.

**Why no external referee signature?** A self-contained manager game can
generate its fictional referee decisions deterministically and validate
them by seeded replay. Ed25519-based external source authentication is
applicable to *imported factual claims*, not required to run the game.

## Still necessary to close P3

This adapter cannot autonomously invent legal extra stoppages, fouls,
corners, throw-ins, offside, medical actions, penalty decisions or VAR.
It does not preserve an authoritative live playing-second/paused-wall
clock beyond the limited scripted goal-restart board sequence.
Departure delay is not calibrated to real observations; neither outfield
boundary mechanics nor administrative exception waivers are modelled.
A rejected late departure must eventually create a **pending replacement
and 60-second running-time entry gate**, not vanish as an ordinary change.
The 300-second v8 open-play phase remains the source of seeded scores.

A future versioned event-driven match engine must own precise event time,
referee whistle/restart, genuine on-field roster and keeper presence,
disciplinary/KDK sanctions, medical treatment, exceptional player
eligibility, possible lawfully awarded penalties/own goals and a single
auto/interactive path, all under fixed-seed replay and accepted tests.

No old M0/v3-v8 API/save state is changed. This code remains isolated,
and M1 P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
and M1 exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
stay OPEN. M2 remains unauthorized.

Rules: [IFAB 2026/27 Law 8](https://theifab.com/laws/latest/the-start-and-restart-of-play/),
[Law 3](https://theifab.com/laws/latest/the-players/),
[time-limited substitutions](https://theifab.com/laws/latest/time-limited-substitution-protocol/).
