# M1 P5 v106 - immutable joint candidate observations

This is a provenance and regression slice for [PR #382](https://github.com/StanleyLl0yd/FootClubSim/pull/382), not another model change. The exact [16-shard successful workflow run #40954498398](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/40954498398), source HEAD `183cc7c24ee96de2a9879027cf8e0209d642f624`, emitted all 16 original group-specific records. Their **actual** job IDs, outcome totals and SHA-256 result digests are frozen in `data/m1-p5-v106-v104-shard-evidence.json` (one 15-fixture group and eight paired fixture-specific seeds per group). No shard result is invented or fitted from aggregate equations.

The independent `scripts/m1-p5-v106-frozen-joint-evidence.mjs` verifies group coverage 0..15, 16 unique source job IDs, counter conservation for all three candidates, per-group original v102 baseline counts, 1,920 matches per candidate, exact aggregate rows, immutable research parameters, original event-source SHA and external reference fields. Its optional group replay regenerates the source version's result counts **and** SHA-256 digests, rejecting drift.

| Source cohort | Shots / match | On target / match | Open-play goals / match | Synthetic xG / match |
| --- | ---: | ---: | ---: | ---: |
| v99 baseline | 21.4781 | 10.9495 | 3.9245 | 3.9270 |
| v104 A | 23.2208 | 8.5849 | 2.6052 | 2.6329 |
| v104 B | 23.2208 | 8.2036 | 2.5250 | 2.5480 |
| Published RPL 2025/26 | 23.1167 | 7.8292 | **2.5375 all-type** | not available |

The display is intentionally descriptive. Published shots/on-target taxonomy has not been harmonized with the source's `goal`/`saved`/`blocked`/`off-target` split, last-line blocks are not separately modelled and the synthetic open-play goals must not be represented as equivalent to all-type real goals. 2024/25 remains an untouched holdout. B's numerical proximity does not prove real-world validity, or justify production probability updates.

```bash
npm ci
npm run build:core
node --test tests/m1-p5-v106-frozen-joint-evidence.test.mjs
node scripts/m1-p5-v106-frozen-joint-evidence.mjs --summary
node scripts/m1-p5-v106-frozen-joint-evidence.mjs --replay 0
```

No historical RNG, production generator, persistent career format, CAS admission, M0 source, external physician/referee control, P3 lifecycle or milestone acceptance is changed. P3 #29/P5 #31/M1 OPEN, P4 #30 deferred, M2 forbidden. Exit audit #3 still needs two complete repository-wide passes.
