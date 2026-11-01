# M1 P3/P5 v121 — separate native v120 journal with browser CAS

Adds an independent **footclubsim-m1-v120 / dense-result-journals**
IndexedDB store, with no upgrades to `footclubsim-m1-v8` or original
`footclubsim-m0`. Add-only initialization; never silently replaces an
existing entry. Each native readwrite transaction reads the current
journal, independently source-replays every existing fixture,
verifies the expected revision, fully simulates the new dense v105
source and only then writes one new journal revision. A validation,
duplicate or stale-revision failure aborts without a partial write.
Never await between opening the transaction and the final put.

An explicitly labelled **experimental first-match** UI can create/load
the isolated v120 journal, calculate the real v105 3×100-second
physical and special-goal source, and atomically persist its first
controlled-club fixture. The full dense-season playback UI, resuming
from a populated dense journal, full P3 authority/stoppages, actual
medical certification, transfer logic and independent calibration
remain unimplemented. Existing v8 UI and CAS remain entirely
unchanged.

Native Chromium/Windows Chrome/Windows Edge browser smoke verifies:
- A complete first v120 calculated match is stored as schema 120;
- The stored result records exactly 270 original dense PRNG draws;
- The stored source omits the duplicated immutable M0 catalog;
- Page reload and original M0 restore are followed by independent
  full-history v120 source verification and successful load;
- v8 career journal is independent, without migration or writes.

No real football source is claimed for fictional referee/doctor events.
No 2024/25 holdout tuning. P3 #29, P5 #31 and M1 OPEN, M2 prohibited,
P4 deferred; #3 full two-pass repository-wide exit audit still 0/2.
