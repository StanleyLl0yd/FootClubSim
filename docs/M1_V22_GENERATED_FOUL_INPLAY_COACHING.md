# M1 P3: internally authorized in-play substitutions at generated fouls (v22)

**20 October 2026. Versioned, isolated, deterministic coaching experiment.
Not final Law 3/12 acceptance, not statistical calibration, no save migration.**

New `src/core/m1-v22-inplay-foul-coaching.ts` and its dedicated
`m1-v22-referee-foul-coaching-source.ts` extend the previous seeded
foul/card/suspected injury/half-time match with **manager-requested
substitutions at in-game referee-created foul stoppages**.

In contrast to externally asserted `referee-authorized` strings:
the public v22 API only accepts a versioned substitution command when
the **same seeded simulation actually generated a physical foul at
that exact virtual checkpoint**. It rejects attempted substitutions
at a guessed/missing whistle, non-foul injury, half-time masquerading
as an in-play window, invalid actors, bench/XI requests and missing
foul stop evidence. The internal source separately validates that
each authorized foul timestamp matches a source-accepted referee
discipline action; the source cannot be used to infer external
signature authentication.

At a validated foul checkpoint the one v8 phase calculation applies:
the physical foul/card, on-field dismissal (if any), signalled
manager change, substituted XI, synthetic restart and then subsequent
eligible open-play shooters. v17's historical event/career contracts
remain untouched. Same-time card + board ordering is deliberately
explicit in v22, whereas v17 correctly rejects such external claims
without authorized source evidence. Half-time substitutions still use
their independent unlimited *window* (bounded by global player quota).
Generated foul windows count towards the existing competition-specific
in-play substitution opportunity ceiling.

**Critical limitations:** The model remains in five-minute checkpoints.
No precise pitch location, lawful free-kick/penalty choice, advantage,
physical referee authentication, replayable sub-minute order, real
in-play clock pause length, goalkeeper/concussion exceptions, medical
diagnosis, stoppage-time extension or calibrated injury/foul
probabilities. The 20-second synthetic foul pause is engineering-only;
a purported restart does not imply a legally executed free kick.
The v22 source rejects any coincident goal-kickoff/foul checkpoint
whose true sequence is unknown. This is an explicit fail-closed limit,
not evidence of a completed referee engine.

Rule references: [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/),
[Law 5](https://www.theifab.com/laws/latest/the-referee/),
[Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/).
Data provenance and calibration remain [free-only](M1_P5_FREE_SOURCES_DECISION.md).

M0 and versioned v3-v21 engines, browser and career persistence
are unchanged. P3 #29, P4 #30, P5 #31 and exit #3 remain OPEN,
and M2 continues to be prohibited.
