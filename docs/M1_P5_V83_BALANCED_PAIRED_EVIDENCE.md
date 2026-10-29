# M1 P5 v83 - reproducible balanced-calendar evidence and paired sensitivity

This study promotes v81's **observed** synthetic fixture summaries from
ephemeral CI logs into a small, verifiable, versioned dataset:
`data/m1-p5-v83-balanced-fixture-evidence.json`. The 16 exact-head
[GitHub Actions jobs from v81](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/40904920782)
ran code at `e07b830b48cc36302c58d0e7eb7ca95b7e6bb097`.
Each retained row is an aggregate over **16 mapped research seeds**.
The data includes exact source job ID and deterministic SHA-256 digest
for all 16 shards; **no 3840 individual score lines, actual RPL
match rows or licensed provider data** are redistributed. Source
reference is the independent pinned v77 RPL 2025/26 season table.

The analyzer
`node scripts/m1-p5-v83-paired-evidence-analysis.mjs`
first enforces 240 distinct synthetic fixtures, 120 mirrored pairs,
15 home/15 away fixtures for each of the 16 clubs, 16 accepted
source replay outcomes per fixture, all 16 correct shard subtotals,
every global conservation equation, and unmodified reference/provenance.
Any inconsistency fails without producing a report.

## Confirmed observed v81 counts

- 3840/3840 successful source-replayed outcomes; zero source rejection
- 4899 final-score goals, 2440 home and 2459 away
- 1088 home wins, 1704 draws, 1048 away wins
- 774 full-time 0:0
- 24511 synthetic source shot events, 720 modelled permanent
  withdrawal rows (not clinical injury diagnoses)

Those are approximately **1.2758 final goals per match**, **6.3831
synthetic shot events per match**, and **0.1999 final goals per
synthetic shot**. The last ratio is a *source-internal diagnostic*:
it does not assume that all final goals come from shots, so it is
not necessarily a real shot conversion rate. Real 2025/26 RPL
shots and xG are unavailable in v77, hence **no real shots or
xG comparison is claimed**.

The model produces 28.33% home wins, 44.38% draws, 27.29% away
wins and 20.16% full-time 0:0, compared with the real 2025/26
RPL 45.42%, 27.92%, 26.67%, 6.25%. The large goal deficit and
excess draws persist after strength-balanced home/away scheduling.

## Statistical sensitivity, not a release confidence claim

The analyzer runs 2,000 fixed-seed resamples of **120 whole mirrored
club pairs**, rather than treating 3,840 artificial outcomes as
independent real league matches. Each resampled cluster contains
two opponent fixtures, with 16 seeds each. It reports illustrative
2.5th–97.5th percentile ranges for goals/match, home/draw/away
shares and 0:0 share. Club identities are reused across pairs,
so even this paired resampling does **not** remove all dependence.
It is a sensitivity calculation, not a license to claim 95% coverage
of the true RPL distribution from one real season.

The following experimental **absolute** comparison windows are
declared prior to any further generator modifications:

| Measure | Provisional difference bound |
|---|---:|
| Final score goals per match | ±0.35 |
| Home win share | ±8 percentage points |
| Draw share | ±7 percentage points |
| Away win share | ±8 percentage points |
| Final 0:0 share | ±5 percentage points |

Current v81 fails every window **except the away-win share**.
These are *provisional engineering targets*, not independently
validated release tolerances or a formal clinical/football statistical
acceptance. The analyzer explicitly reports
`formalCalibrationAccepted:false`, even if future measurements happen
to satisfy all windows.

P5 remains OPEN: an independently verified holdout (2024/25, not yet
accessed), modelled special-goal coverage, additional reference
metrics, cluster-aware statistical evaluation, absolute latency/memory
SLA and fuzz gates remain unfinished. The production RNG, probabilities,
persistent journal, and M0 shipping bundle are unchanged here.
P3 #29 OPEN, P4 #30 deferred, two repository-wide exit audits #3
still required. M1 OPEN; M2 prohibited.
