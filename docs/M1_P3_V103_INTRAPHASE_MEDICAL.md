# M1 P3 v103 - arbitrary-second medical exit/return between checkpoints

Opt-in schema 103 extends the **isolated** replay-verified v101 physical-XI source with a separate arbitrary-running-second medical-action input. It preserves original v8/v101 300-second availability and medical events, original legal prematch and actor validation, the full 54-shot-opportunity clock and the fixed separate 270-draw v103 research PRNG. No M0 bundle, v8/v99/v101 public result, legacy RNG, career save, IndexedDB store or production game logic is changed.

## Scope

The caller can supply an **additional**, versioned, strictly ascending sequence of outfield treatment exits and returns at **any safe integer running second from 1 to 5398**, except exact legacy 300-second checkpoints (0, 300, 600, ...) and exact 100-second shot seconds (99, 199, 299, ... 5399). Examples: exit at 150, restart at 165, return at 250; the 199 shot uses the short-handed XI, while the 299 shot can use the returned player. Each new action applies before the next shot. Coincident event-vs-shot or checkpoint ordering is deliberately rejected instead of guessing referee precedence; 300-second checkpoint treatment and substitutions continue to be handled by the replay-verified v8/v101 source.

- Input action fields match the exact original v7 medical-action schema, except the explicitly excluded ambiguous instants, using a separate v103 admission boundary. New medical IDs must not collide with each other or with checkpoint source action IDs; actions must be plain JSON, sorted, fixture/club-bound and limited to 36 entries. A future integration must enforce global IDs across mixed sources.
- Only original starting outfield players are accepted; a substituted-on player, goalkeeper, already dismissed, withdrawn or substituted-off player is rejected rather than assuming an exceptional referee or medical ruling.
- An intraphase return requires the corresponding preceding intraphase exit for the same player, the original 60-running-second-after-restart check in `admitM1OffFieldMedicalReturn`, a signal identifier and allowed touchline entry conditions. Source-v8 absent players cannot be returned by a newly asserted v103 event and vice versa.
- The physical XI is recalculated before every shot; absent players cannot shoot. Less than seven players or missing/duplicate keeper is rejected, not converted into an invented result.
- The returned shot, medical, physical-transition and full-time event stream has stable IDs, increasing sequences, source chronology, shot attribution, result conservation and exact-seed deterministic replay. When no new medical actions exist, its shot report, selected player attributes and RNG continuation must equal v101.

## Limits and next work

**No external referee or clinical authenticity** exists: the browser-provided signal string is not a cryptographic referee decision or real physician authorization. This prototype accepts arbitrary-second **medical actions only**, not arbitrary-second referee, tactical or substitution commands; it is not a complete referee/stoppage chronology, goalkeeper/serious-injury or concussion exception protocol. It does not generate penalties or own goals. No real recovery diagnosis, cross-fixture KDK sanctions, gameplay UI or event-version-aware v76 career CAS admission is provided.

The next P3 step is to unify all event families under one collision-safe ordered command/decision source and authenticated rules gate, generalize verified referee, tactical and substitution transitions to arbitrary seconds and add version-aware durable journal admission. Production saves cannot accept v103. P5 release calibration remains OPEN, and **none** of the v103 counts may be labelled realistic before comparison to independent calibrated reference and untouched holdout.

## Local verification

```bash
npm ci
npm run build:core
node --test tests/m1-v103-intraphase-medical.test.mjs
```

P3 #29 and P5 #31 OPEN. M1 OPEN; M2 prohibited, P4 #30 deferred. Exit audit #3 still needs two full repository-wide passes.
