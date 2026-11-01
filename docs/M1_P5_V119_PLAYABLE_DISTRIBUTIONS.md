# M1 P5 v119 — real playable v8 distribution, structural calibration blocker

The previous v81/v99/v104 research cohorts do **not** describe the latest
actual browser-playable v8 engine and persistent journal. This independent
tool measures the **same** M1 preparation, user-facing match calculation,
full source-replayed journal append, injury/discipline exclusions and
dossier as the current browser playtest. It is not an alternative simulator.

Run after building `dist/core`:

```bash
npm ci
npm run build:core
node scripts/m1-p5-v119-playable-source.mjs --first-seed=1 --seed-count=1 --fixtures=2 --scenario=ordinary
node scripts/m1-p5-v119-playable-source.mjs --first-seed=1 --seed-count=2 --fixtures=4 --scenario=internal-referee
```

Each attempt is counted. The tool rejects malformed/duplicate CLI options;
saves an exact synthetic seed and actual accepted/failed fixture count,
source-replays the final career journal, counts actual final goals,
home/draw/away/scoreless results, shots, on-target, open-play-only xG,
cautions, dismissals and modelled withdrawals, and displays binary Wilson
intervals and a small-sample analytical goal-mean interval. A failure is
never filtered to improve a numerator. For `internal-referee`, it correctly
records incomplete opponent sanctions and synthetic, uncalibrated injuries.

**Blocking structural result, independent of random seeds:** today's
playable v8/phase engine has only **18 five-minute shot checkpoints** and
can create at most one open-play shot at each, hence at most 18 such
shots in any ordinary match. The independent Sport-Express RPL 2025/26
reference has **5,548 / 240 = 23.1167 shot attempts per match**.
Even a perfectly tuned per-checkpoint probability cannot make the
current engine reach that seasonal average. Therefore increasing
probability, changing save rates, or optimising specific seed scores
cannot close the P5 shot-distribution gate. A **new versioned denser
shot clock integrated with medical/referee physical transitions and
career CAS** is required first. Preserve all original v8 saves/PRNG
and migrate explicitly; research-only v99/v104 engines are NOT
a drop-in replacement for the playable source.

The reference is 2025/26 *development* season only, under the frozen
short-factual-aggregate attribution in the repository. Shot outcome
taxonomy (last-line blocks), all-type vs open-play goals, actual clinical
injuries and provider xG remain unharmonized. Neither the separate 2024/25
holdout nor historical scorelines are tuning objectives. No 10,000-match
independent calibration, credible final tolerance, browser latency SLA or
full two-pass repository audit has passed.

This file is an **observability and structural blocking gate**, not a
realism PASS. P5 #31, P3 #29, M1 and exit #3 remain OPEN. P4 deferred,
M2 prohibited.
