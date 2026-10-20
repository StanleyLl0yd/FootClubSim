# M1-P3 v27: named bench entrants in replayed Law 5 foul evidence

**20 October 2026. Isolated, read-only research. No real injury or treatment is certified.**

The original v25 inspector intentionally supports initial-XI participants only.
This independent v27 variant adds ONE narrowly controlled case: a player named
on the submitted prematch bench may participate in a claimed physically
sanctioned opponent foul **only if** a new, deterministic v23 replay shows both
a real accepted substitution event for that player and the player's physical
presence at the specific **later foul whistle**.

The entrant's team, named bench membership, exact v23 source substitution
event, whistle, card, offender, restart, chronology, source ID and opponent
relationship are replay-verified. The v25 initial-XI contract is unchanged.
A bare manager statement, substitute named on a bench, invalid command,
wrong card, nonexistent incident, forged actor, absent victim or extra JSON
claim fields cannot establish presence.

A successful report remains
`MODEL_FOUL_AND_BENCH_ENTRY_REPLAYED_INJURY_NOT_PROVED`. It exposes
`actualInjuryAuthenticated:false`,
`externalRefereeAuthorityAuthenticated:false`,
`externalMedicalAuthorityAuthenticated:false` and
`physicalLeaveOrReturnAuthorized:false`.
**No legal Law 5 exception is granted**, and no phase, engine, RNG, roster,
career journal, medical action or persistent save is changed.

Reference: [IFAB 2026/27 Law 5](https://www.theifab.com/laws/latest/the-referee/)
and [off-field protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/).
These URLs have a mutable `latest` selector; legal acceptance still requires
independent authenticated injury, medical need, real referee permission and
a robust on-field treatment/return state machine. The other five exception
types and non-bench substitutions remain unsupported by this inspection.

Regression coverage: `tests/m1-v27-law5-named-substitute-evidence.test.mjs`.
Issues #29–31 and audit #3 remain OPEN; M2 prohibited.
