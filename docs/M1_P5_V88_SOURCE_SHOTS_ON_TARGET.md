# M1 P5 v88 - source-on-target metrics without changing the game

The pinned real RPL 2025/26 reference in P5 v85 establishes
**1,879 shots on target in 240 games (7.8292 per match)**.
The current balanced synthetic v81 source generated only
**24,511 all-attempt shots in 3,840 games (6.3831 per match)**.
The sample is therefore already short of the real *on-target*
frequency before any comparison of model accuracy.

This v88 opt-in read-only inspector reports the *actual source v8
`shotsOnTarget` field*, not a guessed fraction of shots or goals.
The referee source already obtains a fully replayed v8 match and
an optional internal metrics trace. v88 only forwards the validated
source `shotsOnTarget` count through that trace into
`inspectM1V88SourceShotOnTarget`, next to the already available
v29 source shot count, total open-play goals and open-play xG.

Every successful inspector result enforces:
- source `kind:'shot'` events exactly equal v8 source shot count
- `0 <= shotsOnTarget <= sourceShots`
- `openPlayGoals <= shotsOnTarget`
- source-replayed match scoreboard equals source open-play goal count
- xG milli is nonnegative and safe integral
- no change to M0, production generator, clinical/referee authenticity,
  or saved source/journal formats.

The v29 legacy observer's output keys and semantics remain unchanged.
The v88 helper is a **model research API**, not an independently
sourced football match nor an authentic referee award. Provider
definitions of blocked shots, own goals and official shots on
target must still be aligned before declaring formal statistical
comparability. Repeated source replay may be expensive in full
historical journals; this is not a performance acceptance.

Follow-up is an explicit fixture-domain sampled cohort for model
on-target rates, optionally compared to the v85 published benchmark
with source-scope caveats. No engine probabilities, xorshift state
transitions or historical save formats are tuned in v88.

P3 #29, P5 #31 and both full exit audits #3 remain OPEN.
P4 #30 deferred, M1 OPEN, M2 prohibited.
