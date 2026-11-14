# M1 P5-5: native v188 240-fixture timing observations

**Status: diagnostic only, no accepted performance budget.** This measurement runs on a real Linux Chromium browser with an actual IndexedDB write/replay path. It is **not** a validated proxy for Windows Chrome/Edge, ordinary macOS Safari, user hardware, quota exhaustion, organic eviction or long-running career durability.

The established `examples/m1-v188-full-season-profile.html` reports 240 canonical sequential fixture commits (30 managed club, 210 others), a full navigation followed by source replay, saved journal byte size, total season progress, maximum per-fixture prepare/commit and cold restore time. Its report `schemaVersion=2` now adds **240 actual observed samples each** for preparation and persistence: mean, median (p50) and p95, alongside maximum. It also records the browser user-agent, post-navigation `performance.memory.usedJSHeapSize` and `navigator.storage.estimate()` **only if exposed**, otherwise `null`. A post-navigation heap estimate is **not** peak resident memory; a storage quota estimate is **not** proof of real quota enforcement or eviction.

All timing measurements are from `performance.now()` in the browser. Percentiles use the nearest-rank convention with `ceil(n * fraction) - 1` for exactly 240 samples. The measurement adds **no new pass/fail time thresholds**, and does not recast CI job `timeout-minutes:45` as a release requirement. CI prints the observed report to the workflow log and step summary; historical records retain their original schema and meaning.

**Next required P5-5 closure evidence:** after P3-4 final-engine freeze, independently remeasure repeatable 240-fixture sessions across native Windows Chrome/Edge and macOS Safari; capture memory, browser profile, release hardware targets, long-tail UI responsiveness, actual quota/eviction and interrupted writes (#155). Predeclare realistic player-visible time and size acceptance bands **before** treating results as PASS, then verify the same exact protected SHA. P5-5 remains OPEN, no 2024/25 holdout opened.

## P5-5 actual native 240-fixture baseline and prospective CI budgets

Prior completed three-browser run
[43012259880](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/43012259880)
on the pre-budget source recorded **observations** (not acceptance):

| Native browser | Total elapsed | Full archive |
| --- | ---: | ---: |
| macOS Safari | 904 s | 4,693,147 bytes |
| Windows Chrome | 1,008 s | 4,723,987 bytes |
| Windows Edge | 1,218 s | 4,687,949 bytes |

Before the **next** exact-head browser replay, this existing UI harness
declares broad CI-hosted limits: **1,800 seconds** for complete creation,
240 fixture commits, interruption, download, file verification and full
restore; **8 MiB** for its complete archive; **512 MiB** for post-restore
JavaScript heap **only if** the browser exposes a numeric estimate.
An absent Safari heap signal remains `null`, not a memory PASS. These
are conservative continuous-integration regression budgets selected after
the documented baseline, **not** predeclared for that historical baseline,
player-device performance SLAs, peak resident set measurements or real
IndexedDB quota/eviction observations. A slower run or oversized archive
must fail, not be relabelled as progress.

P5-5 formal acceptance still requires post-change exact-main runs and
an explicit decision on the unmeasured real quota/eviction, crash and
peak memory cases. No claim that M2 #155 or P5-5 is already complete.

## Real-browser quota-fault recovery (incremental P5-4/P5-5 test)

The existing full-season Chrome/Edge/Safari harness now **prospectively**
includes a transient, isolated `indexedDB.open` throwing
`QuotaExceededError` **after** the verified 240-fixture archive/recovery
flow. It requires the UI to display the normal localized **insufficient storage / download full backup** guidance from its typed quota error, proves the active
table/fixtures did not change, restores the original browser API, and reads
the **actual native v188 IndexedDB record** to verify its revision remains
240. This reuses the same application, fixture journal and native browsers
with no new test runner or alternate persistence layer.

The injection is **not** a disk-fill experiment, an OS quota enforcement
measurement, peak browser memory measurement or proof of arbitrary organic
eviction. The already existing `deleteDatabase` and real file-backed
archive restore cover explicit storage loss and recovery separately.
**P5-4 and P5-5 remain OPEN** until all other required source/real-platform
gates are independently accepted and verified on final `main`.
