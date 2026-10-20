# M1 P3: one replay for goals, half-time and ordinary medical presence (v16)

**20 October 2026. Isolated headless experiment, not the final referee
controller and not a save-format migration.**

The isolated `src/core/m1-v16-medical-goal-halftime.ts` extends the
v15 source-derived goal-restart and half-time chronology with the
ordinary off-field medical events already validated by v8.

- One call to `simulateM1V8MedicalPhases` validates all accepted
  ordinary substitutions and medical actions and computes every
  open-play shot, scorer, score and RNG state with the actual physical XI.
  No separate match results or PRNG streams are combined.
- Treatment exit removes the player immediately from physical on-field
  membership; an accepted ordinary return restores that player.
  Multiple independent same-checkpoint actions are ordered by the v8
  source. Every later shot's participant is checked against this XI.
- Goal-restart opportunities require a goal created by the **same**
  seeded source replay at the immediately preceding shot checkpoint.
  Half-time is mandatory at running second 2700, regardless of goals.
  Half-time changes consume zero in-play substitution opportunities.
- The output exposes a single dual-clock history, a final physical XI,
  remaining absent player IDs and parity against the v8 score/PRNG.
  Candidate outputs are rejected unless they reproduce on replay.
- Input sources, medical history, commands and output events are bounded,
  and getter-bearing/cyclic or non-JSON source trees fail closed.

## Authority, sport-rules and simulation limits

[IFAB Law 3](https://www.theifab.com/laws/latest/the-players/)
and [Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/)
are the rules basis for the modeled substitution windows and half-time.
Ordinary return eligibility uses the existing source-pinned
`src/core/m1-medical-return.ts` running-clock rule, including its
exception restrictions.

**Medical exits, restarts and referee signal IDs are still unauthenticated
caller claims.** This subset does not generate fouls, yellow/red cards,
injuries, penalties, VAR decisions, keeper or concussion exceptions,
arbitrary non-goal stoppages or verified departure time. The v13
late-substitution 60-second short-handed protocol is not integrated.
Wall-clock pauses are synthetic, not observed timestamps. The returned
capability flags record these omissions explicitly.

All v3-v8, v15, M0, storage and career contracts remain unchanged.
P3, P4, P5, full legal acceptance, independent calibration and the
two-pass repository-wide M1 exit audit are still outstanding.
M2 remains prohibited.
