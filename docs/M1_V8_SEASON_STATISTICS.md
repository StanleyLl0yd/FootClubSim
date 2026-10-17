# M1 P4: replay-verified v8 cross-fixture statistics

**2026-10-16. Synthetic only, not an official competition table.**

`src/core/m1-v8-season-statistics.ts` computes deterministic
cross-fixture club and individual statistics over the independent
schema-4 v8 journal. **Every stored fixture is fully replayed and
verified** against its prematch, medical/referee source claims,
immutable initial career catalog and complete source-derived match
dossier before any figure is accumulated.

Per club: completed fixtures, goals for/against, special and open-play
goal categories, shots, shots on target, **open-play-only** xG,
cautions, dismissals, permanent medical withdrawals, named/unused
bench slots, used substitute appearances and synthetic registered,
physically present and temporarily medically absent phase seconds.

Per registered player: named matchday sheets, starts, actual substitute
appearances, unused bench listings, open-play and penalty goals,
defending own goals, attempts, shots, xG, card/dismissal counts,
permanent withdrawals and exactly 300-second-resolution synthetic
phase presence totals. This prevents unused matchday bench personnel
from being silently counted as match appearances, and prevents
temporarily absent injured players from being conflated with
permanent substitutions or confirmed withdrawals.

Before success, total match goals are cross-checked against scored
individual goals plus credited defending own goals, both clubs'
conceded-goals arithmetic, all shots/xG and cumulative caution
counts. Results are derived from a trusted initial catalog and
replay-validated stored events, not from unverified serialized
aggregate totals.

**Explicit omissions:** this result has NO official RPL points,
league table, fixture award, matchday legality certification,
condition/stamina posting, yellow-card accumulation ban policy,
competition registration changes, transfer history or contract
data. It neither generates independent referee/medical facts nor
authenticates KDK decisions. Approximate phase seconds are not
continuous physical playing time. No real match calibration or
season realism approval is claimed. Old M0/v3-v7 saved careers
remain untouched and M1 P3/P4/P5/exit are still open. M2 is
not authorized.

## Separate conventional points research preview

A new, standalone [v8 unranked points preview](M1_V8_UNRANKED_POINTS.md)
replays the same source-verified schema-4 journal and computes
**unofficial 3/1/0 arithmetic** without mutating this season-statistics
report or committing points to the career. It is neither an official
RPL league table nor a change to the no-standings status of this file.
