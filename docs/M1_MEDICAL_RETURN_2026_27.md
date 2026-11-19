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


## Opt-in medical policy 7: independent goalkeeper injury (November 2026)

A new career or an existing v6 career may explicitly request
`medicalPolicyVersion: 7`. This extends v6 without changing historical
v2–v6 fixture bytes, RNG streams, referee decisions or source journals.
It creates one bounded, independently seeded **single-goalkeeper injury**
witness, distinct from the existing paired keeper/outfield collision.
The existing v23 referee time source must contain a matching original
`synthetic-medical-whistle`, `synthetic-single-keeper-injury`, and
`synthetic-medical-restart` in that order, bound to the same unique ID,
team, goalkeeper and match second. The modelled goalkeeper remains on
the physical field before, during and after the on-field assessment.

Policy 7 stores the replay-verified
`autonomousKeeperInjuryOrigin` in the same v188 journal and rejects
wrong keeper/team, forged source IDs, missing or reordered events, or
a downgrade to an earlier medical policy. It supports two-fixture
progression, existing experimental special-goal source and pause
recovery; older matches are never rewritten. **A synthetic incident is
not a clinical finding or evidence of successful treatment.** No
independent head trauma, severe injury diagnosis, blood clearance,
penalty-taker exception, external referee signature or recovery
authorization is asserted. The IFAB goalkeeper-injury *trial* that
requires a teammate to leave for one minute is separate and has **not**
been adopted in the fictional competition.

Primary rules: [IFAB Law 5](https://www.theifab.com/laws/latest/the-referee/),
[off-field protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/),
and [optional goalkeeper-injury trial](https://www.theifab.com/trials/goalkeeper-injury/).

P3-2 and the M1 exit gate remain open. M2 is prohibited; holdout
2024/25 stays sealed.


## Opt-in medical policy 8: unresolved suspected head trauma (November 2026)

A new career or an existing v7 career may explicitly select
`medicalPolicyVersion: 8`. This reuses the existing physical
`injury-withdrawal` source and samples **a suspicion, not a diagnosis**,
from an independent seeded domain. At most one existing withdrawn
participant receives a source-bound medical whistle, an original
injury-withdrawal event and a restart, in that order. A matching v188
`autonomousHeadTraumaOrigin` records exact injury decision and event
IDs, participant, team, running second and unresolved/no-return state.
The physical engine removes that participant from the match and never
automatically returns them, regardless of the ordinary 60-second rule.

The fictional match ledger adds an **indefinite unresolved head-trauma
eligibility hold** for subsequent XI and bench selections. It cannot be
removed by expiry of the independent 1–4 fixture synthetic injury hold.
No clinical diagnosis, external referee authentication, medical clearance,
permanent-concussion substitute or opponent's additional substitution is
invented; the optional IFAB concussion-substitution protocol remains
disabled until competition-specific adoption is verified. This is
**fail closed** and can eventually produce a `NO_LEGAL_LINEUP` if a
career has no valid remaining players. No claimant-provided medical
clearance is accepted.

The existing v23/v29 referee and physical stream, v105 chronology, v188
canonical replay, IndexedDB CAS and pause recovery remain authoritative.
Old medical v2–v7 entries and RNG are not rewritten. A full successful
P3-2 gate still requires bleeding clearance, injured designated penalty
taker and externally verifiable referee/medical permissions.

Official sources: [IFAB Law 5](https://www.theifab.com/laws/latest/the-referee/),
[off-field treatment protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/),
[optional permanent concussion substitutions](https://www.theifab.com/laws/latest/additional-permanent-concussion-substitutions-protocol/).

P3-2 OPEN; M1 3/9; audits 0/2; 2024/25 holdout SEALED; M2 prohibited.
