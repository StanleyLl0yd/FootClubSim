# M1 P3 v149 — consecutive goalkeeper substitutions (regression)

The v146 exactly-two substitution adapter is also required to handle a
goalkeeper introduced from the bench who subsequently leaves for another
unused goalkeeper. The existing v105 300-second physical source, five normal
replacements, three in-play windows, one-active-goalkeeper invariant, bench
admission, foreigner cap and v120 source journal all remain authoritative.

A deterministic synthetic fixture has one starting goalkeeper and two
available reserve goalkeepers. The regression checks ordered 900-second and
half-time 2700-second changes, separate action identity, source replay,
atomic journal application, and the subsequent v126 source-hold review.
It rejects outfield-for-goalkeeper entry, attempted re-entry of a withdrawn
starter, nonexistent reserve and reversed times. This test does not relax
the existing rules or add an invented concussion exception.

This is source-verified fictional play only, not independent confirmation
of an actual referee's whistle, KDK sanction or medical authority. P3 #29,
P5 #31, M1 and exit audit #3 remain OPEN; M2 forbidden, P4 deferred.
No 2024/25 holdout use or match-by-match real-result reproduction.
