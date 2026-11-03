# M1 P3-2 — source-bound two-patient medical events at one whistle

## Playable source and versioning

The existing v188 league journal can now opt into `medicalPolicyVersion:3`
through the **fifth** argument of `prepareM1V188LeagueMatch`. The same
live seeded v29 referee/foul source can identify two *different* players
of the offended team at the **same verified original whistle**, with
ordered assessment evidence, not invented post-match claim objects.

Each pair is derived from an internally seeded carded physical offence:
the primary patient's existing v29 selection is unchanged; a separately
tagged second patient is picked from the remaining physically present
players using an **independent deterministic v3-only seeded substream**.
The exploratory 20% conditional second-patient trigger is NOT calibrated
to real football injuries, nor enabled for prior/default saved modes. At most one additional
patient may be generated per foul. Both patients share the same offence,
whistle and restart; the v105 saved physical replay independently checks
their presence, injury exits/returns (where applicable) and every
subsequent shot/goalkeeper. The two temporary absences may have the same
300-second source time with different stable IDs. v8 accepts this order
without weakening the unrelated historical v7 reader or v103
intraphase action parser.

This is **not** a claim that a specific *collision* was established:
a source-originated collision type and independent collision participants
still need their own evidence. The selected match source's internal
clinical/referee authenticity flags remain false. There is no external
clinical diagnosis, clearance, referee order or competition-level
authorization.

## Compatibility and negative controls

- v188 root stays version 188 and ordinary `disciplinePolicyVersion:2`
  is preserved. A new entry with `medicalPolicyVersion:3` replays only
  the paired-patient generator; version 2 uses the previously accepted
  goalkeeper-on-field medical generator; absent medical version uses
  the unchanged old generator, including legacy saved fixtures.
- The allowed historical progression is absent -> 2 -> 3. Once
  version 3 is present, a later entry cannot downgrade it. An explicit
  caller downgrade also fails at prepare/apply. Moving from 2 to 3
  is allowed only through a new replayed source commit.
- The persisted request contains *source inputs and replayed physical
  events*, not caller-provided patient IDs, referee authorization or
  `sourceLaw5Evidence`. Adding forged evidence is rejected as an
  invalid request. Changing the saved events fails exact source replay.
- Direct v186 evidence verifies at most two different patients for
  one source incident, requires the first then the explicitly marked
  second patient, and checks each against the real whistle, physical
  decision and return transitions. Duplicated patient, forged second
  marker or third patient is rejected.
- Positive seeded tests cover the actual playable first fixture,
  source whistle, different players, 300-second physical transitions
  when triggered, full saved journal replay, two-fixture continuation
  and v2-to-v3 upgrade.
- The existing native `examples/m1-v188-cas-smoke.html` now persists
  v3 through IndexedDB and browser navigation, checks automatic version
  continuation, rejects downgrades without mutation and verifies
  serialized CAS races across Chromium, Windows Chrome/Edge and Safari.

## Acceptance limits

This is another **partial** P3-2 functional increment. Unsupported:
source-originated *actual* collisions (including same-team and GK with
outfielder), independent GK injury, head/severe injury/bleeding,
independent award of an injured penalty taker's kick, real
60-running-second off-field return / minute-resolution stoppages,
and any authenticated external medical or referee authority. No
historical real-world match result is being recreated. No change to
2024/25 holdout status. P3-2 remains OPEN; the M1 nine-block matrix
and two full repository-wide exit audits are unchanged.
