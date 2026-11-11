# M1 P3-2 — independently seeded in-game collision source (medical policy v5)

## Exact playable source

An opt-in `medicalPolicyVersion:5` selects a new, internally seeded
**standalone medical whistle**. Unlike v4's collision *at an existing
opponent-carded foul*, v5 can select two different, currently present
players of the **same club** at a time where no generated foul,
withdrawal or carded offence occurs. Both are internally assessed as
needing on-field attention. The event is NOT backfilled by a user
request or an external medical/referee attestation.

The historical goal/card/treatment RNGs and v8/v105 open-play source
are unchanged. v5 uses a separate deterministic `M1_V35` RNG
substream with a fixed per-checkpoint draw budget, selects at most
one autonomous collision per match and leaves both patients on the
physical pitch during an on-field assessment. At the chosen
checkpoint the same v23 referee-source timeline emits:

1. `synthetic-medical-whistle` identifying the internally seeded
   autonomous collision ID and patient club.
2. `synthetic-same-team-collision` naming the first and the **separate**
   `collisionPartnerPlayerId`; both belong to the single current
   physical XI before the next source shot.
3. `synthetic-medical-restart`, advancing the modelled wall clock by
   the source's bounded synthetic stoppage duration while preserving
   the running clock. If a 300-second source checkpoint contains no shot
   or other event, the pending standalone stoppage is still emitted at its
   own second **before** the 2700-second interval or 5400-second full-time
   boundary. Regression tests compare multiple seeded fixtures and verify
   monotonic running and stopped-wall clocks on both halves.

No opponent offender or card is forged to create the medical
exception. The time and both players are independently checked against
the actual in-game referee stream. The medical return/physical XI
at the next shot is unchanged because both patients remain on-field
under the *same-team collision requiring attention* Law 5 subset.

The `v186` inspector verifies the complete whistle/collision/restart
triple, source ID, event ordering, team and both physically present
participants, absence of a same-second generated offence, and type
classification from the canonical GK/outfield roster. A second
synthetic event, forged fixture/team/origin, or altered participant
cannot authorize the exception. The inspector exposes **two**
distinct patient witnesses with no invented offender and never
claims clinical or external referee authentication.

## Journal and rollback rules

- Historical unversioned/v2/v3/v4 persisted entries retain the
  exact original generators, source events and saved bytes.
- A new v5 fixture is deterministically regenerated during
  `prepare`, `apply` and cold `validate`; version transitions
  are monotonic `unversioned → 2 → 3 → 4 → 5`.
- Once a v5 fixture is committed, following fixtures continue v5.
  A claimed downgrade or an invented `sourceLaw5Evidence` field
  is refused without altering journal revision or saved history.
- V5 persists `autonomousMedicalOrigin`: the **exact internal source
  witness** (ID, two patient IDs, team, time and source whistle /
  collision / restart IDs). The verifier regenerates it independently
  and compares all canonical bytes; an old v4 record with only a forged
  v5 version tag fails schema validation, while a tampered witness
  fails replay. The source witness is **not external evidence**.
- The modelled whistle is not persisted as a standalone `v105`
  physical transition. Full integration of the medical clock into
  that physical event stream remains an acceptance requirement.
- Domain tests cover a live autonomous whistle (not an opponent
  foul), two physical XI patients, the keeper/outfielder class,
  positive save/reload/replay, old v4→v5 continuation, six
  adversarial source mutations and refusal of stale/downgraded
  commits.
- Native Chromium/Windows Chrome/Edge/Safari v188 CAS smoke requires
  an actual autonomous collision in the first fixture before it
  exercises IndexedDB reload, tampering, downgrade and concurrent
  writes.

## Acceptance boundaries

This uncalibrated *fictional* model only proves one independent
same-team collision with both patients on-field. It does **not**
authenticate real referee/medical orders, assess an independent
single-player GK injury, model concussion/head or severe bleeding,
authorize an injured penalty taker, or implement a true **60 seconds
of running time after restart** off-field return with full intraphase
playability. Nor does this alone complete all independent medical
stoppage and numerical-strength cases.

Therefore P3-2 **OPEN** and M1 **OPEN**, even after exact-head CI.
P3-3/P3-4/P5 remain independent acceptance blocks; M2 prohibited,
2024/25 holdout SEALED, repository-wide exit audits still 0/2.

## New-career playable integration (source v5; existing model)

New playable browser careers now opt into the **already implemented** v188
`medicalPolicyVersion:5` at their first fixture, alongside the existing
source-2 goal generator. After the first commit, the UI uses that **stored
first-entry source version** for the remaining fixtures, while older careers
retain their original unversioned/v2/v3/v4 medical replay and saved bytes.
A career that has already explicitly upgraded to v5 remains monotonic by
the canonical journal source reader. There is no schema migration, new
medical clock/engine, custom client claim, random override or external
diagnosis.

The existing **full 240-fixture real browser season** acceptance harness
verifies that *every* saved new-career fixture has version 5 and a
replay-authenticated origin array, and requires at least one actual
autonomous collision. The same archive already must fully restore after
deletion in native Chrome, Edge and Safari. It does not mislabel a
fictional source witness as independent clinical/referee authority.

**P3-2 remains OPEN:** serious injury/concussion/penalty-taker exceptions,
authentic clinical discharge, and direct integration of independent v5
whistle into the persisted physical event stream still require evidence.
P3-3/P3-4 and P5 final-source validation remain separate obligations.
