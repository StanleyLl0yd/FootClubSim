# M1 P3: one source-derived goal and half-time referee timeline (v15)

**20 October 2026. Isolated headless research entrypoint, not the final
match engine and not a career-save migration.**

Official IFAB 2026/27:
- [Law 3](https://www.theifab.com/laws/latest/the-players/): in a
  five-substitution competition, three in-play opportunities per club;
  half-time changes do not use these opportunities. The substitution
  procedure must be complete before the half restarts.
- [Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/):
  two 45-minute halves; half-time interval cannot exceed 15 minutes.
- [Law 8](https://www.theifab.com/laws/latest/the-start-and-restart-of-play/):
  following a goal, the conceding team restarts with a kick-off.

`src/core/m1-v15-goal-halftime-roster.ts` combines the strictly
source-derived subsets of v12 (goal restart) and v14 (half-time) without
concatenating independently computed scores or RNG streams:

1. A **single** replay of the v8 seeded match validates all manager
   commands, competition limits, identities, bench eligibility and
   source shot participants. All requested changes must be normal
   substitutions at either an internally generated goal restart or
   exactly 2700 running seconds at the internal half-time whistle.
2. The authoritatively generated seed/roster-sensitive goal must occur
   at checkpoint - 1. Free-form `referee-authorized` text at any
   other checkpoint does **not** create an in-play stoppage.
3. Each internally generated goal restart has source shot evidence,
   synthetic board signals, physical XI updates and bounded stopped-wall
   time. A group with N same-team changes needs at least N-1 seconds
   in the explicitly synthetic pause. Both teams can change players.
4. Half-time is generated independently from the RNG. The ordinary
   substitutions are applied to that same physical XI, consume zero
   in-play windows, then the second half begins after an independently
   bounded interval. A goal at t=2699 cannot manufacture an additional
   goal-derived substitution window at t=2700.
5. Every subsequent v8 shot must have a real on-field shooter. Final
   on-field rosters, goals, PRNG state and draw count reconcile with
   the **same** v8 calculation. A versioned event timeline exposes
   both running and synthetic stopped-wall time. An untrusted candidate
   replay is checked against fully re-derived output.
6. Input source trees, commands, durations and event counts are bounded.
   An invalid command or state rejects the entire run; no old saved
   journal is changed.

## Explicit limits

This remains a five-minute seeded phase model; the virtual wall pauses,
signal and instant departure procedures are **idealized**, not recorded
physical referee evidence. This adapter does not autonomously generate
fouls, cards, penalties, treatment injuries, VAR decisions, arbitrary
non-goal restarts or the IFAB 60-running-seconds late-substitute
entry rule. It does not recompute shots with ten players during a
pending late replacement (v13 remains a separate limited protocol).
It does not replace or mutate v3-v8 engines, persistence or M0
synthetic catalogs.

These omissions deliberately appear in the returned false capability
flags. The original v8 full report is the single source for goals
and RNG, not two independently joined or invented results.

Acceptance tests cover combined and half-only commands, zero
substitutions, source-v8 RNG and score parity, physical XI history,
the three opportunity distinction, bad duration / unsupported
stop reason / false goal, invalid participants / duplicates,
tampered replay and malformed untrusted JSON.

[M1 P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
[P4 #30](https://github.com/StanleyLl0yd/FootClubSim/issues/30),
[P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
and [exit #3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
remain open. M2 is prohibited.
