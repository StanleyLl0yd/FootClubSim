# M1 P4 v48: paired native schema-6 batch vs single CAS

**Research-only, 22 October 2026. No release acceptance threshold.**

The v44 Chromium profile revealed repeated O(history) replay cost
during sequential CAS. The existing schema-6 adapter and domain engine
already support bounded, atomic batches of up to 16 commands without
changing persistence format. This experiment tests whether using that
existing mechanism saves replay work without altering model results.

A single native Chromium session creates **two disposable M0 careers**
with the same synthetic 16-club pack, selected club, seed and schedule.
It derives **the same 12 physical-presence source commands** before
timing commits. Career 1 appends each command separately (12 write
transactions); career 2 appends the exact same commands in two
six-command atomic batches (two write transactions). Command IDs,
fixture IDs, source snapshots and derived per-fixture facts must match
exactly, excluding only the different surrounding career identifiers.
Both journals undergo full replay before and after a real navigation.

The native workflow prints the actual two commit-duration series,
full-history read times, source preparation time, browser version,
match counts and equality verdict. **There is no hard-coded timing
PASS requirement**. These measurements are paired on one CI runner
but the sequential arm runs before the batched arm; cache/warmup,
scheduling, real-world editing cadence and browser power can affect
wall time. This is not a 240-fixture season, user latency percentile,
proof of commercial realism or a permission to merge synthetic match
results into an official RPL table.

No engine, M0, persistence adapter, schema-6 journal, signature,
medical or sanctions interface has changed. P3 #29, P4 #30,
P5 #31 and M1 exit #3 remain OPEN; M2 prohibited.

## Measured native paired result, 22 October 2026

[Hosted run 39772403870](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/39772403870)
on HeadlessChrome 155, one Linux runner: **12 independent sequential CAS
calls 16,041.4 ms total**, versus **two six-command atomic CAS calls
3,559.1 ms**. Within this *single order-biased run*, the batch arm
took 4.51 times less aggregate commit wall time. Model source preparation
was measured separately at 2,496.6 ms. Complete journal replays after
appends took 2,359.3 ms versus 2,333.2 ms. Derived results were
identical across arms after browser navigation.

The updated exact-head native test additionally submits a deliberately
invalid **second** command in a two-command batch to each empty
disposable journal, requiring a typed rejection and revision zero
before either measured arm begins. No partial update is permitted.

**Crucial causal boundary:** actual subsequent matches can depend on
preceding treatment, fatigue, suspensions, transfers or lineup decisions.
Pre-generating independent sources for this experiment does **not**
authorize batching dependent playable career matches. This research
only validates identical preapproved synthetic sources and cannot be
used as a release performance threshold or official sports result.
