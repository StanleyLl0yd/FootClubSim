# M1 P5 v123 — independently observed **dense playable** distribution

The earlier frozen v81/v104 studies cover separate research models;
v119 measures the current **18-shot-slot v8 playable implementation**.
v123 measures the new **v105 54-slot** engine through the **same
source-verified schema-120 career append** used by the opt-in v120
browser. Its input is a locked fictional M0 catalog and a deterministic
fixture-specific seed for each selected-club match; all journal entries
are fully replayed before inclusion. Every attempted game is kept
in the accepted/rejected accounting.

Reproduce:
```bash
npm ci
npm run build:core
node scripts/m1-p5-v123-dense-cohort.mjs --first-seed=1 --seed-count=1 --fixtures=4
node scripts/m1-p5-v123-dense-cohort.mjs --first-seed=1 --seed-count=2 --fixtures=8
```

The generator returns final goals, shots, on-target and **synthetic
open-play-only xG**, home/draw/away and 0–0, conservative 95% Wilson
binary intervals, and the fraction of fixtures exceeding v8's
18-shot maximum. Retain source hashes, SHA, seed coverage, job log
and runtime when making an evidence freeze. No per-match historical
scores or winners are targets.

The structural limitation of v8 is removed **in principle**:
54 potential shot slots exceed the published 2025/26 development
aggregate 5,548/240 = 23.1167 shot attempts/match. This **does not
mean the actual model averages 23**; measured output and uncertainty
must establish that. Provider on-target/blocked definitions remain
unproven equivalent, real goals cover penalty/set-piece/own-goal
types absent in this ordinary-only dense source. No real xG,
authenticated referee/cards or clinical injury data are available
for comparable rates. Missing metrics are `null`, not fictionally
reported as zero.

This is a bounded developmental measurement, not P5 acceptance.
To progress: run independently seeded balanced/mirrored cohorts
with fully supported incident types, freeze real taxonomy and
thresholds prior to tuning, reserve 2024/25 holdout exclusively
for later evaluation, independently test release performance and
complete two whole-repository exit audits.

P3 #29, P5 #31, M1 and exit #3 OPEN; P4 #30 deferred, M2 prohibited.
