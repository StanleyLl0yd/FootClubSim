# M1 P4: replay-derived player physical exposure and match facts (v24)

**20 October 2026. Isolated in-memory read-only P4 research, not a
career transaction, not calibrated fatigue, not authenticated sanctions.**

`src/core/m1-v24-physical-exposure.ts` derives physical playing seconds
and source-linked basic match attribution from ONE independently
generated and verified v23 match. It does not simulate a second match.

For each causal v23 referee/goal/coach/medical timeline event, the
accountant integrates the **previous physically present XI** over the
elapsed model running seconds since the last event. Simultaneous
checkpoint events add no phantom minutes. The implementation validates
nondecreasing chronology, 7–11 on-field players per side at all event
intervals, unique IDs and exactly 5400 model running seconds.

For every participant who actually entered the physical XI it records:
- on-field model seconds and physically present at full-time;
- recorded open-play shots and open-play goals;
- first cautions, second-yellow and direct-red dismissals;
- irreversible model injury withdrawals;
- synthetic temporary treatment exits and returns;
- actual applied substitutions in and out, not mere boards/signals.

Aggregate discipline/medical counters reconcile against the original
source record; team goals reconcile against the same match's final
score. All output is replay-verifiable from the original fixture,
seed, policy and optional coach commands. Forged minutes, discipline,
aggregate counters, claimed authority or altered player order fail.

Crucially this report does **not** infer condition, injury diagnosis,
medical treatment quality, sanction length, disciplinary committee
orders, fitness decay, match importance, transfer value, or a
career save. Physical playing exposure alone is a deterministic input
for future review, **not a statistically calibrated fatigue equation**.
The `fatigueDeltasCalibrated`,
`crossFixtureSanctionAuthorityAuthenticated`,
`injuryDiagnosisAvailable` and
`medicalReturnAuthorityAuthenticated` fields remain false.

Same-source constraints, five-minute synthetic phase RNG limitations
and invented injury probabilities are described in
[M1 v23](M1_V23_SEEDED_TEMPORARY_TREATMENT.md).
No M0/v3–v23, persistent journal/browser store, public UX or
compatibility change has been made. M1 P3 #29, P4 #30, P5 #31 and
exit #3 remain OPEN. M2 is forbidden pending full acceptance and
two repository-wide audit passes.
