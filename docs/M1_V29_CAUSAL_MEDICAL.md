# M1 P3: causally linked synthetic victim and medical decisions (v29)

**21 October 2026. Isolated, versioned simulator experiment. Not an
observed injury, independent clinical evaluation, authenticated referee feed,
or validated complete IFAB medical procedure.**

## Change and compatibility

`simulateM1V29CausalMedical` runs the v23 referee, substitutions,
medical actions and v8 physical-XI/shot calculation through **one**
versioned match path. A mode-specific, fixed-budget medical RNG uses the
same 54 treatment draws (three per five-minute phase) as v23; the original
90 referee draws and underlying 90 shot draws are not shifted. The public
v23 entry point, schema, JSON output and original medical selection
remain unchanged. M0-v28, career journal schema-5 and browser saves are
unchanged. No caller-provided victim, card, medical need or permission is
accepted as authoritative.

For a generated, carded **physical** challenge the v29 mode obtains the
opposing physical XI at the exact foul whistle, *before* newly requested
in-play substitutions. It selects a potential victim from still-eligible,
present **original starting outfielders**, deterministically using
`treatmentPlayerRoll`. Thus the offender is not the victim, players
not present at the whistle cannot be declared victims, and new bench
entrants cannot be mistaken for someone struck before entering.

`treatmentRoll < 0.28` creates a **synthetic medical-need hypothesis**.
The separate `treatmentTeamRoll` selects between modelled on-field
assessment (no physical departure) and ordinary off-field assessment.
The historical v29 JSON tag `on-field-quick` names the seeded on-field
branch, **not** a legal requirement that medical assessment be quick:
the 2026/27 Law 5 amendment removed that condition for a physically
fouled player whose opponent was cautioned or sent off. The engine does
not model verified assessment duration or clinician authorization. The rate and branch split are uncalibrated stress parameters,
not estimates of true RPL injury incidence, doctor decisions or Law 5
exception frequency. If an off-field assessment would cross the unsupported
half-time boundary, exceed the available phase horizon, reduce a team below
seven or conflict with an existing pending return, it is **not created**.
All ordinary off-field actions enter the existing v8 medical source and
actually remove the player from physical XI until a source-validated return
300 running seconds later (with the existing synthetic/unverified
referee signal). Quick treatment leaves that player's physical presence
unchanged; v29 records the decision in its own source-bound assessment
ledger, not as a fabricated v23 referee event.

Each v29 assessment binds the incident, offender source decision, foul
whistle, restart, victim team/player and, where applicable, source
medical exit and return event IDs. The engine fails closed when IDs,
chronology, opponent relationship, physical presence or source
transitions do not reconcile. Verification rebuilds the *entire*
versioned result and rejects modified assessments, fabricated
authenticated authority or changed physical events.

## Explicit unimplemented acceptance

- Only a subset of physical carded challenges is handled; no separate
  injury diagnosis, concussion/severe-injury decisions, collision,
  goalkeeper treatment, penalty-taker exception or named-bench
  treatment is supported.
- There is no true second-resolution treatment duration, independently
  trusted clinician/referee identity, treatment-completion certificate
  or real-world injury evidence. Internally generated decisions are
  deterministic game hypotheses, **not externally authenticated facts**.
- No new schema-5 persisted fields or P4 cross-fixture medical and
  disciplinary state; no calibrated fatigue, injury incidence or
  complete RPL/IFAB acceptance.
- Existing v25/v27/v28 claim inspectors retain their conservative
  `actualInjuryAuthenticated:false` result and never treat v29's
  seeded clinical hypothesis as independent proof.

Relevant rules: [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/)
and [Law 5](https://www.theifab.com/laws/latest/the-referee/).
M1 P3 #29, P4 #30, P5 #31 and exit audit #3 stay OPEN.
M2 remains prohibited; two full repository-wide audits remain pending.
