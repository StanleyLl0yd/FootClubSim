# M1 P5 v68: source-replayed opportunity budget and conversion

This diagnostic separates the **number of synthetic shot opportunities**
from the **realized open-play goal/shot ratio** without modifying
the simulator, RNG, full source replay, save format, or historical
catalog. It accepts only v29 full-replay cohort reports that include
the v67 18-phase source shot bound, validates exact count arithmetic
and never converts rejected games into fictitious scoreless fixtures.

The fixed 256-attempt 8-fixture x32-seed hosted run records the
empirical phase-slot occupancy, average shots per admitted model game,
realized goals per source shot, and per-admitted-model-game goals.
Mathematical identity (shots/match × goals/shot = goals/match)
is checked, but the measured empirical conversion frequency is NOT a
shot xG estimator nor an external RPL finishing calibration.

The source has at most one shot in each of 18 five-minute
phases across BOTH clubs. The model does not generate special
penalties or own goals. Comparing this model's open-play-only
goals directly with historical all-kind Russian Premier League
goals would be invalid without metric reconciliation. Independent
historical RPL shot/xG coverage is still unavailable and upstream
publisher licensing is unverified. CIs assuming independent
synthetic shots are labelled naive and must not be used as
statistical proof because seed/fixture replication is clustered.

The 2024/25 reserved holdout remains untouched. P3/P5 and
the two repository-wide exit audits remain OPEN; M2 forbidden.
