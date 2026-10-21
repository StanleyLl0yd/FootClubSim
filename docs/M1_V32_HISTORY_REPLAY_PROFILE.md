# M1 P4: v32/schema-6 full-history replay cost observation

**Developer-only bounded workload, 21 October 2026. Not a release gate.**

The new isolated v32/browser adapter must validate the existing
schema-6 career history inside a single IndexedDB readwrite
transaction before committing any new fixture. The cost may grow
with the number of matches, because each later CAS replays all
earlier source events, simulated patient/medical actions and
physical-time accounting. We must measure this rather than assume
that v26's browser smoke establishes long-career performance.

`scripts/m1-v32-history-workload.mjs` accepts bounded
`--fixtures=1..32` and `--firstseed=1..(2^32-128)`.
Each fixture is simulated by the actual v29/v31 source and
posted with `applyM1V32ExposureBatch` at its expected revision.
Every stored source and synthetic medical event is replayed at each
append; the final JSON-cloned journal undergoes another full
`validateM1V32ExposureJournal` check.

The JSON report contains per-revision checkpoints (1, 2, 4, 8, etc.),
incremental replay/apply elapsed milliseconds, journal byte size,
final full-history validation time, memory RSS, total source
generation time and a deterministic SHA-256 over source facts.
Timing numbers are intentionally *not* part of the determinism
assertion: test correctness uses fixture IDs, revisions and hashes.
The optional hosted workflow captures one observed Node 24/Linux
run (default four fixtures, manually up to 32).

```sh
npm run build:core
node scripts/m1-v32-history-workload.mjs --fixtures=4 --firstseed=1
```

No accepted per-match latency, browser watchdog or native
IndexedDB transaction-lifetime requirement has been established.
This Node measurement intentionally **does not** claim on-disk CAS
latency, Safari/Windows quota or eviction behavior, OS crash
durability or a production memory budget. It must not be used to
approve main-thread synchronous replay at long career lengths.
A separate native browser performance experiment and an
architecture decision (e.g., bounded incremental source-indexing
without sacrificing full untrusted-history verification) are
required before shipping.

All patient needs, sanctions and fatigue-related effects remain
synthetic or uncalibrated. P3/P4/P5 and M1 exit remain OPEN; M2
prohibited.
