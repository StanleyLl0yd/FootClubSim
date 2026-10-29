# M1 P5 v67: physical bound on generated v29 shots

The v29 source-replayed match generator inherits one possible shot
per five-minute phase from the v5/v8 phase model. There are exactly
18 phases per regulation-time 5400 running seconds, so no such match
can emit more than 18 open-play shots across BOTH clubs.

This is a **mechanistic bound**, not an empirical claim about how
many shots real Russian Premier League games contain. v67 measures
minimum, maximum, shotless games and shot rate only on successfully
source-replayed synthetic matches. It asserts that every shot event
occurs at an eligible distinct end-of-phase timestamp. Violations
fail the diagnostic rather than silently changing the denominator.
The fixed-seed v29 engine and its output/save schemas are untouched.

The earlier v62 source corpus found 3214 accepted and 882 rejected
games among 4096 attempts, with just 0.977 synthetic open-play goals
per accepted match against 2.654 observed total goals per real
2023/24 RPL match. Goals of different kinds are not strictly
comparable. No independent licensed same-season per-match shot or
xG reference has yet passed provenance and coverage checks, so this
diagnostic must NOT declare the 18-shot limit a statistical failure
or fit probabilities to the same 2023/24 aggregate.

Next research must separate (a) shot opportunity frequency,
(b) open-play shot quality/finishing, (c) special goals and
(d) rejected-scenario selection. Candidate fixes must preserve
source chronology and test untouched 2024/25 holdout only after
preregistration. P3/P5 and M1 exit remain OPEN, M2 prohibited.

## Hosted finite observation

The scoped v67 research workflow reproduces a fixed 256-attempt
8-fixture x 32-seed v29 corpus and publishes observed minimum,
maximum, per-accepted mean shots and shotless games. Rejected games
are excluded from the conditional denominator, never replaced by
fictitious zero-shot games. All 18-phase bounds are asserted. This
study is not an RPL shot/xG calibration gate.
