# M1 P4: v31 replayed physical exposure of v29 causal medical events

**21 October 2026. Isolated, read-only physical time; no authorized
medical diagnoses, fatigue calibration or career journal migration.**

`deriveM1V31CausalPhysicalExposure` runs the exact v29 generated
medical incident/victim/referee/physical-XI source, then passes that
source's **already replay-validated** v23-compatible match event stream
through the same player-seconds/event accounting as the existing
`deriveM1V24PhysicalExposure`.

v24's existing public entry point and schema remain unchanged: its
physical accounting was factored into one internal helper with no
alternate consumer-controlled untrusted source API. v31 is a separate
new versioned entry point, not an interpretation of old persisted rows.

The new output keeps independent v29 source events and physical
accounting side by side:

- Every in-field victim retains physical presence at the restart; the
  backwards-compatible `on-field-quick` v29 tag is **not** a Law 5
  quickness prerequisite under the amended 2026/27 rule.
- For each synthetic temporary departure, source-verified exit and
  return remove exactly the active physical time represented in event
  snapshots. Source-only return takes place 300 running seconds later;
  no external doctor authorization or precise treatment time is claimed.
- Per-player physical seconds, shots, goals, card effects, actual
  substitutions and temporary actions reconcile with source referee
  counters, team totals, original physical rosters and 5400 running
  seconds. No second independent simulation of match score is allowed.
- `verifyM1V31CausalPhysicalExposure` re-runs the full seeded source
  and rejects fabricated victim, time, event, authority or physical
  exposure; incomplete or malicious inputs fail closed.

The output always declares `careerJournalIntegrated:false`,
`realWorldInjuryAuthenticated:false`,
`externalRefereeAuthorityAuthenticated:false`,
`externalMedicalAuthorityAuthenticated:false` and
`crossFixtureFitnessAndSanctionsCalibrated:false`.

**Next P4 step:** a separate versioned journal must accept v31's source
and physical projection without reinterpreting existing v26/schema-5
rows. Durable browser CAS, cross-fixture medical/disciplinary state,
source authorization and release-quality history performance then
require independent verification. No v31 fields are persisted in v26.
P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN; M2 prohibited.
