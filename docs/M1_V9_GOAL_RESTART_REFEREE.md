# M1 P3: first internally derived virtual-referee stoppage

**19 October 2026. New isolated v9 *research adapter*, not a new persisted
v9 match engine, not an autonomous full IFAB referee and not calibration.**

## Why this changes the source of authority

Earlier v8 allowed a human/operator-provided
`stoppage: 'referee-authorized'` normal substitution at every 300-second
checkpoint as long as other tests passed. The [time-limited departure
gate](M1_V8_TIMED_SUBSTITUTION_COVERAGE.md) checked matching 10-second
single/group reports, but the caller could still invent the existence
of a stoppage. A string is not a referee.

[IFAB 2026/27 Law 8](https://theifab.com/laws/latest/the-start-and-restart-of-play/)
requires a kick-off after a valid goal. Current v8 already generates
*immutable, seeded, internally replayed shot goals* at virtual
`299, 599, ...` seconds, just before the next 300s command checkpoint.
Thus an internally simulated goal at 299 makes the following 300s
checkpoint **eligible for a virtual goal-restart stoppage**. The match
engine is the source of the goal, not a supplied authoritative string.

`src/core/m1-v9-goal-restart-referee.ts`:
1. Strictly preflights all requested normal-substitution commands, with
   bounded plain-JSON shape (no getters, cycles or aliases).
2. Runs the **unchanged v8 engine via the existing single/group IFAB
   departure timing gate**, retaining its actual seeded shots, score,
   active player eligibility and normal substitution opportunities.
3. Derives a candidate restart proof **only** from scored ordinary
   internally computed `shot` events stamped at a phase-end second.
4. Requires **every** ordinary in-play substitution checkpoint to have
   such a preceding engine-generated goal. Absent goals return a typed
   `MISSING_ENGINE_GOAL_RESTART`; no caller-provided referee ID,
   medical note, fake score or fabricated free stoppage can bypass it.
5. Returns deterministic source event IDs, scoring team and checkpoint,
   and the same unchanged v8 match report. No saved career, old engine
   or original RNG stream is mutated or revised.

Seed tests demonstrate a genuine goal at t=299 with substituted
players at checkpoint t=300, rejection when no shot occurred at t=299,
required group timing, late outgoing-player refusal, malformed JSON
and exact legacy v8 parity without replacements.

## Carefully bounded legal meaning

- The v8 events are *phase-granularity* observations. The timestamp
  `t=299` denotes a modelled goal at the end of that phase; the
  `t=300` checkpoint is a **candidate virtual goal restart**, not
  evidence that a referee actually signalled and conducted a kick-off
  at exactly that wall-clock second.
- IFAB 2026/27 Law 3 still requires referee permission, legal field
  entry, board timing, safety/injury exception handling and in-play
  change windows. The old timed gate checks reported board times but
  **cannot authenticate** them. Accordingly the adapter explicitly
  emits `wallClockTimingAuthenticated:false` and
  `fullLaw8RestartProcedureVerified:false`.
- This path deliberately does **not** admit stoppages for a save,
  off-target shot, corner, throw-in, free kick, injury or VAR:
  v8 does not yet establish those exact events at the appropriate
  time. A goal scored at t=5399 cannot certify a substitution at
  full-time t=5400.
- In-game simulated referee authority will ultimately come from the
  own deterministic, versioned, auditable whistle/ruling/restart
  transitions. An external RFU identity/signature is **not required**
  for an original fictional match. A detached Ed25519 proof applies
  only when importing external trusted claims; it is not the game
  referee engine.
- This narrower adapter is NOT wired to production UI/CAS. All P3
  requirements for minute-level events, fouls, cards, penalties,
  injuries, yellow/red state, goalkeeper replacements and automatic
  referee decisions remain outstanding.

No changes to approved M0, v3-v8 career journal or P5 source policy.
P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31) and
M1 exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
remain OPEN. M2 is not authorized.
