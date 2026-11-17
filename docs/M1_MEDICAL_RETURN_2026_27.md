# M1 P3: IFAB 2026/27 medical off-field return gate (limited)

**2026-10-16. Research-backed admission validator, not full injury gameplay.**

Primary sources reviewed: [IFAB Law 5, 2026/27 referee and injuries](https://theifab.com/laws/latest/the-referee/), [IFAB Off-field treatment and assessment protocol, 2026/27](https://theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/) and [2026/27 law changes](https://theifab.com/law-changes/latest/). The edition label **2026/27** is required: `latest` URLs can later move to another edition.

The protocol requires a non-exempt assessed outfield player who triggered an injury-related stop or medical assessment to leave and remain off until **one running-clock minute after play restarts**, with referee permission to return. A player entering while the ball is in play must return via the touchline; out of play permits other boundary lines. If the half ends before 60 live seconds, the player may return from the start of the next half. IFAB separately lists exceptions for keeper injuries, certain collisions, severe injuries, disciplined opponent fouls and an injured designated penalty taker. The *applicability* and complete contextual verification of these cases are separate.

`src/core/m1-medical-return.ts` defines a standalone schema-1 **ordinary outfield-player return admission check**, requiring a validated M1 prematch, named **initial starting outfield** participant, recognized medical stop reason, distinct off-field and running-clock restart times, elapsed 60 live seconds (or a tightly bounded first-half exception), and a referee signal ID. Wrong boundary, early entry, invalid chronology, goalkeeper exception and bench player without independently verified substitution history are rejected with typed errors.

**Security / incompleteness:** a plausible signal ID, timestamps and source JSON are **not referee authentication**. This module does not track which players are temporarily on or off the pitch inside v7 shots, does not prove a match restart took place, and does not supply actual stoppage handling, substituted-in outfield participation, blood/serious-injury/head-injury/penalty-taker exceptions, extra-time periods, substitution of the absent player or return from a physical assessment. It cannot turn a player permanently withdrawn under the existing v6 `injury-withdrawal` command back into an active participant. These two concepts must not be conflated or silently integrated.

Use only after an independently trusted match-controller confirms a genuine ordinary injury/assessment and actual restart times. Do **not** use it as an official authorization to restore someone on the pitch in current v7 gameplay. Full P3 #29 and M1 exit #3 remain open.


## Playable v188 opt-in medical policy 6 (November 2026)

New fictional matches may opt into `medicalPolicyVersion: 6` through the
existing `prepareM1V188LeagueMatch` fifth argument. This mode keeps the
single causal v23/v103/v105 referee and physical-XI source, but emits an
**intraphase treatment-return at exactly T + 60 running seconds** after the
source-generated foul restart. The player's checkpoint treatment exit,
60-second intraphase return, physical presence for subsequent shots, source
clock and persisted career CAS are replayed together. It does not merely
print a 60-second advisory timestamp. The existing schema-188 journal stores
the new `intraphaseMedical` array only on policy-6 entries; unversioned
and policies 2–5 retain their original saved events and RNG sequence.

Version 6 also retains the v5 independent same-team/keeper collisions and
may be combined with the existing fictional special-goal source. Missing
source events, early returns, forged referee permission tokens, policy
downgrades and edited saved physical actions are rejected. The modelled
permission token is deterministic fictional input, **not externally
verified medical or referee clearance**. No new external clinical evidence,
head-injury diagnosis, severe-injury clearance, blood clearance, independent
single-keeper injury or injured penalty-taker decision is implied.

This is a partial P3-2 integration, not acceptance of the complete gate.
The 2024/25 holdout remains sealed and M2 remains prohibited.
