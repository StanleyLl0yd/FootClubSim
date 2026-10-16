# M1 P5: v8 seeded medical/special-goal invariant corpus

**2026-10-16. This is a 32-seed synthetic regression campaign, not independent calibration.**

\`tests/m1-v8-invariant-campaign.test.mjs\` checks 32 deterministic seeds
spread over eight valid synthetic fixtures. Each case executes v7 as a
historical reference, v8 with no medical events and v8 with an
ordinary initial-starter treatment exit/return, plus independently
reconstructed verification and adversarial result mutation.

Checks include:
- Exact no-medical v7 team report parity, final RNG state and 90 draws.
- No shot by a temporarily absent player before referee-permitted return.
- Penalty and own-goal contributions exactly once, alongside synthetic
  open-play shots, xG coverage, shot counts and team totals.
- Reconstructed v8 event/replay equality and rejection of forged score or
  missing medical provenance.
- Final physical on-field XI restoration after authorized treatment.

These are **invariants**, not evidence of a real injury distribution,
match-statistics realism, authenticated referee rulings, independently
verified medical durations, performance bounds, licensed dataset or
M1-P5 #31 exit. Continue with external lawful benchmarks, stronger
fuzzing and complete full-repository two-pass audits. Historical
v6/v7 journals and M0 saves remain unchanged.
