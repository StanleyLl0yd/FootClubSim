# M1 P1: source-replayed in-match coaching instructions

The playable `M1LeagueSeason` now schedules a real coach order **after
kickoff**, rather than modifying only the prematch tactical snapshot. A
manager selects a virtual 15/30/45/60/75/85-minute change, new formation,
mentality, pressing and tempo; a separate individual `attack/balanced/defend`
instruction may be sent to a nominated active outfielder at the same time.
The v8 phase simulator already supports both command kinds. This change
connects them to the canonical v188 source generator, source replay, CAS
journal admission and the browser manager controls.

## Security and event integrity

- Manager-provided controls contain **choices** only. The core binds each to
  the selected club, real next fixture, canonical actor, stable command ID
  and five-minute checkpoint time. Full tactical plans and player ownership
  are strictly checked. Up to 8 unique orders are allowed per fixture.
- The generator first creates the same causal referee/medical source using
  already verified physical substitutions, then combines generated
  referee events, substitutions and the coach commands in one ordered source.
  The v8 physical match engine evaluates live tactics and player focus
  only from their chosen checkpoints onward; a past chance is never
  reconstructed from a later decision.
- The optional `inMatchOrdersVersion:1` exists only when at least one
  coach order is present. The original v188 journal schema, immutable M0
  catalog, seeds and existing legacy sources remain unchanged.
- Verification of an entire journal extracts the exact source order,
  reconstructs each manager instruction from trusted team/actor identity,
  regenerates the causal source and checks the full resulting match, before
  an atomic revision CAS can admit it. A fake timestamp, opponent tactical
  command, absent player, extra field or changed plan is rejected.
- Source replay and referee-generated physical availability remain
  authoritative; this does not invent referee permission to substitute.

## Scope and evidence

Unit tests cover command identity, monotonic virtual time, selected-team
authority, missing/forged flags, non-retroactivity of events before an order,
deterministic change in future chance source, and full v188 apply/replay.
A manager can edit team tactics and give a player instruction at a source
checkpoint while keeping the historical prematch/tactical commands intact.
This is **P1 functional progress**, not a full P1 acceptance claim: arbitrary
real-time pauses, true user-controllable live match interrupts, final tactics
calibration and official referee timing remain open. The 2024/25 holdout
stays sealed, and P3/P5 gates and two M1 exit audits remain open.
