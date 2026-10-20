# M1-P3/P4 v28: Law 5 inspection against a replay-verified career journal

**2026-10-20. Evidence-only, read-only research; no medical/legal acceptance.**

`src/core/m1-v28-journal-law5-evidence.ts` links the existing v25/v27
generated physical-foul evidence inspectors to the independently replayed
**v26 schema-5 career journal**. The caller supplies the initial career,
untrusted journal, current expected revision, fixture ID, incident ID and
Law 5 claim. Crucially, there is **no caller-supplied prematch, policy,
substitution, foul event or card** for the incident inspector to trust.

Before inspecting any individual foul, the ordinary v26 journal validator
replays **every saved fixture** from immutable career catalog, source context
and deterministic seed, checking all saved score/physical-exposure/discipline
and RNG projections. The selected fixture must actually have been applied,
and must match the expected journal revision. The source for v25/v27 is
then reconstructed exclusively from that accepted saved journal fixture.
Previously benched but legitimately substituted-in players remain subject
to the stricter v27 accepted-entry and exact-whistle-presence checks.

Invalid journal revisions, poisoned prior rows, altered source seeds,
fictional fixtures, unrecorded incidents and mismatched card/opponent
relations fail with typed errors without altering source, state or
persistence. Tests exercise journal poisoning, stale revisions, invalid
claims and deterministic rereplay.

A successful response is labelled
`JOURNAL_AND_SYNTHETIC_FOUL_REPLAYED_NO_MEDICAL_AUTHORITY` and has
`actualInjuryAuthenticated:false`,
`externalRefereeAuthorityAuthenticated:false`,
`externalMedicalAuthorityAuthenticated:false` and
`physicalLeaveOrReturnAuthorized:false`. A browser-local journal is
not a cryptographic source of real injury evidence, and the simulated
foul's causal relationship to an actual injured victim remains unverified.
No immediate field treatment, injury diagnosis, legal Law 5 exception,
fatigue or retroactive career update is permitted.

No legacy M0/v3-v8 save, physical-XI engine, v23/v24 computation or
browser IndexedDB transaction is changed. Two full repository-wide
audits, final P3/P4/P5 acceptance and M1 exit #3 remain OPEN.
