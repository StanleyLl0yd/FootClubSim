# M1 P3-2 — explicit internal collision origin, medical policy v4

## Scope

The selected, playable **v188 two-team league journal** has an opt-in
`medicalPolicyVersion:4` mode. When the existing independent seeded
v3 stream selects *two different patients on the same carded-foul
stoppage*, v4 now emits one additional
`synthetic-same-team-collision` **referee-source event**, with both
actual physical XI participants, running time, injured club and the
original generated source action ID. This source event is created
*before* physical exit, not from a caller-supplied medical claim.

The same internal source match contains the carded offence, foul
whistle, collision, medical exits and returns, and restart in causal
order. `v186` verifies both patients and their single shared
collision event against the original whistle, exact referee
availability action, team/position and saved `v105` physical
transitions, rejecting invented, duplicated or reordered events.
For these internally simulated source decisions it distinguishes
`source-modelled-same-team-collision` from
`source-modelled-keeper-outfield-collision`, using the canonical
player position for the real participating goalkeeper. Neither category
is a medical diagnosis.

**Important limitation:** the modelled collision currently occurs
*within an existing carded-opponent-foul stoppage*. This is **not** a
fully independent collision/stoppage generator, not a claim that
two patients selected by previous v3 were necessarily in a collision,
and not proof of referee or clinical authority outside the
simulation. Standalone same-team/keeper–outfield collision stoppages
remain P3-2 work.

## Backwards-compatible source replay

- Versions absent/2/3 regenerate precisely the old v188 model
  without any new collision event. Old persisted journal entries
  are not rewritten and old RNG streams do not move.
- Version 4 is required **only** for new v4 source commits, is
  verified on read and write and automatically continues after the
  first v4 fixture. The monotonic sequence is absent → 2 → 3 → 4.
  Explicit downgrades or fabricated new fields are rejected.
- The persisted `M1V188Request` contains the normal replayed
  fixture, planned commands, checkpoint treatment and v105 events.
  The collision audit fields are **derived transiently from the
  internally regenerated exact source**, never trusted as
  caller-supplied `sourceCollisionEventId` or referee permission.
- Core positive and negative tests require a seeded first-fixture
  collision, both actual XI participants, source/card ordering,
  v105 physical replay, immutable source action identity, rejection
  of modified participants/source IDs and duplicate collisions,
  and v3→v4 two-fixture CAS continuation.
- Native Chromium, Windows Chrome/Edge and Safari CAS smoke
  must select an actual collision-positive witness before testing
  IndexedDB persistence, reload, downgrade refusal and
  concurrent writers. An ordinary v4 tag without the collision
  event is not sufficient evidence for this smoke.

## Open P3-2 acceptance items

An **autonomous** keeper injury/medical whistle, independent
same-team and goalkeeper/outfielder collision stoppages, full
head/severe/bleeding medical exceptions, a source-awarded injured
penalty taker, a genuine 60-running-second return in the shared
physical shot timeline, and authentic referee/medical clearance are
still unsupported. This model is fictional and uncalibrated.
P3-2 remains **OPEN**; M1 cannot close on this PR.
M2 is prohibited; 2024/25 holdout SEALED; exit audit #3 remains 0/2.
