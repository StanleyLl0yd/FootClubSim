# M1-P3 v25: replay-bound inspection of a generated sanctioned foul

**2026-10-20. Isolated, read-only research. No Law 5 exception is legally admitted.**

This is an incremental bridge from the [six narrow Law 5 claim shapes](M1_MEDICAL_LAW5_EXCEPTIONS_2026_27.md)
to one source-derived event history, **not** a new way to skip the one-minute
[ordinary off-field return gate](M1_MEDICAL_RETURN_2026_27.md).

`inspectM1V25GeneratedFoulLaw5Evidence` regenerates one deterministic v23
match from the original validated prematch/seed, manager policy, and optional
half-time/in-play commands. Only the 2026/27 **physical opponent offence with
a yellow or red card** branch can currently be checked. The other five Law 5
exception groups return `UNSUPPORTED_EXCEPTION`: no supporting engine
evidence has yet been modelled for them.

The inspection binds an initial-XI injury claim to a specific internally
generated incident ID and the original event IDs for its foul whistle,
disciplinary sanction and restart. It checks the actual recorded card
(including second-yellow dismissals), offending player and team, physical
offence classification, modelled running second and pre-sanction physically
present XI. Missing, unrelated, or inconsistent evidence fails closed with
typed errors; an initial starter no longer physically present at that
whistle is rejected. All replayed facts originate from ONE v23 game;
nothing is accepted from a caller-supplied match or card record.

**Important limits:** v23 invents foul events using seeded synthetic rates,
and it does **not** model a confirmed injured victim of that foul. A successful
inspection establishes only that the structural claim is consistent with a
generated foul and its physical-XI timeline. It does not establish an injury,
medical assessment, quick-treatment duration, third-party referee authority,
or an in-place treatment permission. The result explicitly reports:
`actualInjuryAuthenticated:false`,
`externalRefereeAuthorityAuthenticated:false`,
`externalMedicalAuthorityAuthenticated:false` and
`physicalLeaveOrReturnAuthorized:false`.

The authoritative rule sources are [IFAB 2026/27 Law 5](https://www.theifab.com/laws/latest/the-referee/)
and the [2026/27 off-field treatment protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/).
These `latest` web paths are mutable; review the edition before any legal
acceptance or future rules migration.

Tests: `tests/m1-v25-law5-generated-foul-evidence.test.mjs` include seeded
replay provenance, successful/incorrect card, wrong offender, phantom incident,
absent initial-XI victim at whistle, excluded bench players and hostile JSON.

There are **no** mutations to the v23/v24 match calculation, medical presence,
RNG, career journal, IndexedDB persistence, UI or old saves. P3 #29, P4 #30,
P5 #31 and exit audit #3 remain OPEN. M2 remains prohibited. Remaining P3:
independent injury/medical evidence, fully authenticated referee/medical
authority, verified real-time whistle/restart and immediate treatment/return
state machine (including five remaining exception types).
