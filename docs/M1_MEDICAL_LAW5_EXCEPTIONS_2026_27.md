# M1-P3: IFAB 2026/27 Law 5 exception-claim inspection

**2026-10-20. Isolated research-only addition. P3 is NOT accepted.**

Authoritative rule context: [IFAB Law 5, 2026/27](https://www.theifab.com/laws/latest/the-referee/), [2026/27 off-field treatment and assessment protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/) and [law changes for 2026/27](https://www.theifab.com/law-changes/latest/). The `latest` paths are not immutable; implementations must remain explicitly pinned to the **2026/27** edition and re-review later editions. The current rules distinguish ordinary post-restart one-minute temporary absence from the Law 5 injury exceptions.

`src/core/m1-medical-exceptions.ts` is a pure version-1 **claim shape and relationship inspector**, not an executable decision about treatment or player presence. It covers all six enumerated groups, separately:

1. injured goalkeeper;
2. goalkeeper and outfield-player collision;
3. players of the same team colliding;
4. declared severe injury;
5. physical offence punished by an opponent's yellow or red card;
6. declared injured penalty kicker when a penalty has been awarded.

A strict, bounded plain-JSON claim must name a validated fixture, club and **initial XI** injured player. Collision/disciplinary claims must name the second actual initial-XI player, with validated team and role relationships. A collision exception additionally requires a separate **unverified** assertion that both players need attention; the opponent-card exception requires a separate **unverified** assertion that the offence was physical (a card for dissent or a non-physical offence is not enough). Wrong-team teammates, phantom opponents, bench entrants without confirmed substitution chronology, invented goalkeepers, unrelated card claims, and contradictory/extra evidence fail closed. The 2026/27 sanctioned-opponent exception must not be narrowed to the superseded 2025/26 quick-treatment wording.

**Crucial distinction:** a structurally matching claim does **not** prove the event occurred. Neither a string card claim nor `severeInjuryDeclared`, `penaltyAwardedDeclared` or `penaltyTakerDeclared` is authenticated. The response therefore unconditionally exposes `refereeAuthorityAuthenticated: false`, `medicalAuthorityAuthenticated: false`, `currentPhysicalPresenceVerified: false` and `playerLeaveOrReturnAuthorized: false`. No active XI, score, RNG, v7/v8/v23/v24 event stream, career journal or save is changed. This inspector must **not** be used to bypass the ordinary `m1-medical-return.ts` gate.

Required before P3 acceptance: an independent referee source derived from the live incident history, medically supported exception classification, physical time/ball-state verification, and explicit Law 5 in-place treatment/departure/return state transitions. Substituted-in participants, collisions at actual whistle instants, severe injuries, bleeding, concussion policy, and team-specific rules still require dedicated handling. Neither external authenticity nor legal acceptance is established.

Regression cases: `tests/m1-medical-exceptions.test.mjs` covers positive examples for every exception group, case mismatches, forged and partial evidence, incorrect IDs, bench players, immutable inputs, getters/cycles and deterministic results.

M1-P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN. M2 remains prohibited.
