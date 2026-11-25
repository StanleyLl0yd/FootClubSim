# M1 P5-5 current-format browser performance evidence

**Status: prospective measurement protocol, not acceptance.** The
[owner-approved M1 scope (ADR-0013, #554)](https://github.com/StanleyLl0yd/FootClubSim/pull/554) retains
measured desktop performance and ordinary recovery; extreme real quota,
eviction and release lifecycle remain in #155.

## Existing CI baseline (observed, not target-device SLA)

The exact [#552 UI workflow](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/45596935419)
passed 240 fixtures on real Windows Chrome, Windows Edge and macOS Safari.
The complete scenario includes setup, manual and automatic matches,
interactive pause/recovery, ordinary interruption, export/import, injected
IndexedDB rejection and full-season restore. Elapsed times were 715, 1214
and 1017 seconds; archive sizes 4,881,266, 4,825,656 and 4,777,489 bytes.
Post-restore JS heap was 36,893,696 / 36,601,862 / unavailable respectively.
A null metric is not a passed memory gate.

## Predeclared CI acceptance measurement

Use the existing isolated Windows 2025 Chrome/Edge and macOS 15 Safari
runners, pinned workflow actions, locked dependencies, Node 24, exact
candidate source and real browsers. Preserve the existing complete scenario
limits (1800 seconds; 8 MiB UTF-8 archive; 512 MiB observed post-restore
JavaScript heap where exposed). A browser must provide actual memory
evidence; silence or null alone is insufficient.

For Safari, before the next measured run, additionally set a **2 GiB**
sampled aggregate RSS ceiling for Safari and its named WebKit WebContent,
Networking and GPU processes on the isolated macOS runner. Read `ps`
RSS in KiB and convert to bytes every five seconds from before navigation
through restored-season verification. Require at least two samples with
both Safari and WebContent processes present; report sample counts,
baseline, maximum sampled aggregate, and limit. The aggregation may count
shared pages and other WebKit processes, so it is conservative and is not
a per-tab heap, true instantaneous peak, physical footprint, or a
player-device SLA. Do not substitute it for Chromium JS heap or claim
the metrics are directly comparable. Sampling or measurement errors fail
the test, rather than passing an unavailable value.

The actual next CI jobs must meet these prospective limits. Do not
retrospectively change the budgets to accept an observed failure. Any
revision needs an explicit reason, evidence and a new measured run.
No engine, save contract, calibration parameter or holdout is changed.

P5-5 remains OPEN until the final default source, ordinary recovery,
all applicable browser observations, and written exact-main evidence
are reviewed under the revised M1 matrix. No stable-release or #155
acceptance follows from this protocol.
