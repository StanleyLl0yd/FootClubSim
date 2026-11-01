# M1 P3 v115 — playable continuity from replay-validated match history

Status: **synthetic single-club M1 playtest; no official real-world authority or full P3/P5 acceptance**.

This increment replaces the v113 blanket refusal to simulate another match after
any known withdrawal or dismissal. It derives a bounded roster exclusion list
from the **already source-replayed** schema-4 v8 match journal for the controlled
club's exact ordered fixture sequence, before constructing the next legal XI.

- A permanent in-match injury withdrawal is a **medical hold**: no automatic
  recovery, return-to-play date or physician signature is fabricated.
- An in-match straight red remains excluded until a future separately
  authenticated review; no invented one-game KDK duration.
- A second-yellow dismissal or four separate simple cautions creates a
  **modelled one-fixture ban**. The next fully recorded controlled-club
  fixture consumes it only if the player is absent from both XI and bench.
  Historical attempts to use a banned or held player are rejected.
- Exclusions are applied *before* the registered-player/foreigner-cap-aware
  XI+bench picker. The rest of the club can continue playing; when a legal
  lineup cannot be formed, preparation fails. M0 initial snapshot remains
  add-only/unchanged; final journal writes retain atomic IndexedDB CAS.
- An opponent's unrecorded fixtures cannot be invented. Known prior medical
  and straight-red holds for an opponent are conservatively excluded, but
  complete opponent sanctions are explicitly **not** claimed or certified.

The optional **virtual internal referee** UI scenario reuses the existing
isolated deterministic v19 incident generator (seed-domain-separated cards
and suspected injuries), reproduces its generated commands in the v8 source
match and records them via the existing journal replay and CAS. This is
**fictional in-game authority only**: no authentic RFU/KDK judgment, real
doctor or referee signal is asserted. Generator rates are not yet calibrated;
choosing the scenario is a technical playtest, not a release-ready referee
model. Regular/temporary-treatment/substitution scenarios remain compatible.

Tests cover medical exclusion over multiple subsequent matches, one-match
second-yellow and fourth-caution bans, unresolved straight red,
deterministic modelled incidents, source-backed journal replay and immutable
M0. All normal branch tests/native browser smoke/CodeQL are required.

Still open in P3: complete physical/time laws, full fictional league fixture
history, official in-game adjudication/recovery interface, career season state,
special goals and all exception rulings. Still open in P5: independent,
predeclared **distributional** realism (not match-by-match prediction),
shot/referee taxonomy and performance gates. No 2024/25 holdout tuning,
no deferred P4 scope expansion, no M2.
