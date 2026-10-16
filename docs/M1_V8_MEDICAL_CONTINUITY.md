# M1 P3/P4: v8 cross-fixture medical continuity review

**Status: synthetic, read-only, not a medical eligibility or recovery ruling.**

The new `deriveM1VerifiedV8MedicalContinuity(initial, journal)` projection
replays and validates the complete isolated schema-4 v8 career journal before
inspecting recorded permanent in-match medical withdrawals. It correlates
each withdrawal with subsequent round-numbered matchday sheets for that
same fictional club/player. Results are ordered by fixture round, never by
the order in which fixture commands happened to be committed.

- Preserve the source fixture, round, club and footballer for every proven
  in-match permanent medical withdrawal.
- Flag later starter, used substitute and **unused** matchday bench listings.
  Being named on the bench is relevant even without playing.
- When more than one withdrawal is recorded, associate each later listing
  with the **most recent preceding** withdrawal, without rewriting history.
- Keep the original journal and every M0/v3-v7/v8 format untouched.
- Reject any untrusted journal or modified dossier using the existing
  full-source replay, not a blind count of self-reported withdrawals.

A subsequent matchday listing **does not prove** that the player was legally
ineligible or medically unfit. The earlier withdrawal does **not prove**
how long treatment or recovery should last; the later appearance does
**not prove** an authenticated medical clearance. External medical and
competition evidence is still needed before a proper eligibility decision.
Therefore this report does not block an XI, award/void a fixture, create
injury days, modify career condition or automatically issue sanctions.

The review is deliberately independent of M2 persistent season gameplay,
official league registrations and clinical provenance. It is an engineering
continuity check under M1 #29/#30, not M1 P3/P4 acceptance, gameplay
calibration or M2 authorization. Use the separate #31 baseline and source
rights gate before making numerical realism claims.
