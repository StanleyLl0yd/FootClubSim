# M1 P5 v71: scoreless outcomes stratified by model xG and shot volume

v70 established exact 4096-case open-play totals: 28,926 source shots,
4,859 realized open-play goals, 5,220.916 units of *internal* v8 model
xG and 1,124 scoreless fixtures with shots (zero shotless fixtures).
These observations by themselves cannot show which match-level
conditions concentrate scoreless outcomes.

v71 tests a bounded, reproducible 256-case **subset**, synthetic
fixtures 1..8 with seeds 1..32, through the same opt-in v69 full v29
source replay. This is not a fresh independent football sample.
A predeclared deterministic analysis bins each accepted match by:

- Internal total shot xG: [0,0.75), [0.75,1.50), [1.50,infinity).
- Source shot events: 0..5, 6..10, 11..18.

Each group records accepted games, zero-goal games, source shots,
realized open-play goals, internal model-xG, conditional zero-goal
fraction and per-game averages. Conservation is tested across both
partitions. The hosted result must match the previously observed
256-game v68 source totals (1972 shots, 303 open-play goals), which
were derived before v69/v70 and without changing the simulator.
Rejected games are never interpreted as 0:0 or zero xG.

**Interpretation limitations:** This is an *association* of internally
computed expected shot quality and observed source scorelessness, not
a controlled causal counterfactual, external RPL xG reference,
independence-corrected CI, or an acceptable finishing-rate calibration.
Group boundaries are diagnostic, not empirically fitted thresholds.
Matches share synthetic catalog, fixtures and seeds.

Neither phase frequency nor goal probability, RNG, save schema, CAS,
regular match API or medical/referee controller is changed. No
2024/25 holdout read. P3/P5 and two full M1 repository-wide audits
remain OPEN; M2 prohibited.
