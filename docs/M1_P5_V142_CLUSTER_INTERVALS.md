# M1 P5 v142 — per-career uncertainty, without fixture IID assumptions

Consumes **actual** source-replayed v141 shard record lines, not score
forecasts or rows of artificially independent fixtures. Each unique seed
career is the sampling unit and can contribute up to four correlated games.

`node scripts/m1-p5-v142-cluster-intervals.mjs shard-1.txt ... shard-8.txt`
reads lines with `V141_CAREER_CLUSTERS=` from recorded CI output and
emits one `V142_CLUSTER_INTERVALS=` JSON line. Shard conservation,
unique seeds, replay-count claims and source flags are checked before
computing any rates. The tool does not generate matches, change PRNG,
write back saves, or access 2024/25 holdout.

Rates use aggregate totals / accepted fixtures. For at least 30 distinct
seed careers and at least 30 accepted fixtures, an exploratory cluster
sandwich interval is reported. Each seed's centered whole-career
residual is kept intact; multiplier 2.1 is an approximate conservative
large-sample cutoff, **not** a finite-sample proof of 95% coverage.
When insufficient clusters are supplied, the interval is null rather
than implying precision. Outcome rates are bounded to [0,1], event
rates to nonnegative values, open-play xG uses milliunits.

Actual v141 CI logs must be collected and their SHA-256 verified before
claiming measured v142 intervals. Synthetic test records validate the
arithmetic only. The comparison is not calibrated: the independent
provider event taxonomies, full opponent history, disciplinary authority,
clinical record provenance, performance gates and predefined
statistical acceptance remain OPEN. M1/P3/P5 and exit audit 0/2 OPEN.
No M2 or P4 work.
