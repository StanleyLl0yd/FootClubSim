# M1 P5 v111 — independent bounded fuzz and operational resource observation

This is a separate, **opt-in** adversarial study of unchanged v104 research
candidates, not new production or calibration probabilities. It uses a
domain-separated SHA-256 seed scheme distinct from frozen v100/v106 evidence,
without touching the sealed 2024/25 holdout.

- Four reproducible runner shards, four fixture positions from distinct
  15-fixture groups per shard, 16 seeds/fixture: **256 unique inputs** and
  three model parameter cases each = **768 research simulations**, each
  independently replay verified.
- Independently fold event streams into per-team goals, shot, on-target and
  synthetic xG totals, including 270 fixed PRNG draws, terminal 5400-second
  clock and event sequence. Throw on inconsistent reports.
- Corrupt at least one source event per selected fixture and require replay
  verifier rejection; count adversarial checks.
- Record actual wall time and peak process RSS on each GitHub-hosted runner,
  with a **generous operational abort budget** of five minutes/shard and
  1024 MiB RSS. These are safety limits for the research job, **not**
  measured production performance thresholds or release performance PASS.
- Emit SHA-256 output digest without timings so identical seeded behavior
  can be compared across runs.

The independent event categories are **still not aligned to independent
Sport-Express, Sportbox or Opta provider definitions**. Synthetic open-play
goals remain separate from external all-type goals. Penalties, injuries,
yellow/red cards, referee provenance, real xG and P3 lifecycle cannot be
calibrated from this source.

```bash
npm ci
npm run build:core
node --test tests/m1-p5-v111-fuzz-performance.test.mjs
node scripts/m1-p5-v111-fuzz-performance.mjs 0
```

Run the four-shard `M1 P5 v111 independent fuzz and resource limits`
GitHub Actions workflow on exact HEAD. Do not claim successful evidence
before the jobs complete and report observed outputs. P5 #31, P3 #29,
exit audit #3 and M1 remain OPEN; P4 #30 deferred; M2 prohibited.
