# M1 P5: same-seed causal v29 tactical sensitivity (v57)

**22 October 2026. Synthetic differential mechanics, NOT empirical
RPL calibration.** The old M1 baseline paired tactical check used a
much earlier open-play-only engine. This experiment exercises the
newer **v29 internally generated referee and causal medical incidents**
and v31 **replay-verified physical exposure** on the same fixtures.

`scripts/m1-v57-paired-tactics.mjs` runs each original fixture and
seed in two isolated full source replays: neutral home tempo 50 and a
configurable home tempo 0..100. The fixture, randomized catalog, both
starting lineups, opponent tactics, competition restrictions, referee
RNG domain, clinical hypothesis RNG domain and shot RNG seed are held
identical. The only intended intervention is the home tempo. It
verifies both full reports before measuring home/away goals, shots,
physical player-seconds, internal fouls/cards and modelled medical
assessments. Each pair must independently consume 90 referee draws,
54 medical draws and 90 underlying match draws.

The output has a SHA-256 fingerprint, separate rejected-pair reasons,
the exact *jointly admitted* sample size, seven paired difference
means, sample standard deviations and normal 95% intervals, plus
increased/equal/decreased home-shot sign proportions with Wilson 95%
intervals. Rejection is **pairwise**: one failed branch never becomes
a fictitious zero observation and never enters the denominator.
Because acceptance of a scenario may be affected by the intervention,
the measured differential is explicitly conditional on joint success.

Run after `npm run build:core`:

```sh
node scripts/m1-v57-paired-tactics.mjs --start=1 --count=6 --fixtures=2 --tempo=100
```

Safe bounds: seeds 1..2^32-1, 1..64 per fixture, 1..8 fixtures,
at most 512 pairs. CI uses shorter deterministic comparisons and
negative CLI tests. Identical input tempo 50 must yield **exact zero**
differences for every metric and the same full replay fingerprint.
No tactical effects are asserted without live measurements.

There is no metric-compatible, independently permitted real-RPL
tactical-intervention dataset. This is **not** a scientific causal
effect for real teams, injury-rate calibration, independent
statistical benchmark, licensed holdout or accepted time/memory
gate. The observed Russian 2023/24 goal aggregates are not
tactical counterfactuals and cannot be used to fit effect sizes.

M0 save/roster provenance, v29/v31 source output and career storage
are unchanged. #31 remains OPEN; M2 remains forbidden.
