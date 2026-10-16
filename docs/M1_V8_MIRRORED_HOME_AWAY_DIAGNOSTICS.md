# M1 P5: mirrored synthetic home/away cohort (v8)

**2026-10-16. Internal engineering diagnostics only, NOT statistical
calibration against real football and NOT an M1 acceptance gate.**

`src/core/m1-v8-mirrored-diagnostics.ts` processes an existing pair of
reverse-leg synthetic fixtures with the **same two clubs**, their identical
team-specific lineups and tactics, unchanged source pack, and identical seed
for the two legs. No special refereeing or medical actions are inserted.
Each seed gives exactly two v8 matches, one with each club at home.

The report preserves the fixed source pack and engine/event/RNG versions,
exact fixture identities and seed interval. It records:

- total goals per two-leg pair;
- home-team goals minus away-team goals **per fixture** (the two-leg
  difference is divided by two);
- each fixed club's home-goal minus away-goal paired difference;
- observed sample means, sample standard deviations and two-sided
  normal-approximation 95% intervals (null for a single pair).

No sign or magnitude is assumed as correct. In particular, these paired
numbers **do not independently identify a causal home advantage**:
two different chronological fixtures, tactics, rosters, initial source
pack construction and stochastic noise can contribute. Future licensed,
pre-registered comparison baselines and representative test fixtures are
required to argue realism or to set numeric acceptance thresholds.

Example:

```bash
npm run diagnose:m1:v8:mirror -- --count=64 --first-seed=1
```

The CLI allows 1..10,000 pairs, each producing two simulated matches
without altering any career save, gameplay catalog or repository data.
CI uses a small deterministic smoke only; larger benchmarks require
separately recorded runner/time/source metadata.

This supplements M1 P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
without closing it, changing M0 or authorizing M2.
