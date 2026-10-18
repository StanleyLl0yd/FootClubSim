# M1 P4: native v8 browser CAS interoperability check

**2026-10-16, test harness; interoperability accepted only if its
exact-head and exact-main CI runs succeed.**

`examples/m1-v8-cas-smoke.html` uses the real browser IndexedDB API,
not a fake IndexedDB model or a Node DOM emulator. It constructs a
versioned v8 match with an ordinary temporary treatment exit/return,
one asserted scored penalty and one defending own goal, then:

1. Saves an original M0 synthetic initial career without migrating it.
2. Initializes and atomically applies one v8 journal fixture.
3. Navigates/reloads to a new page execution context.
4. Loads and replays the persisted v8 journal, checks the recorded
   treatment source, scorer/goal arithmetic and unchanged M0 career.
5. Rejects duplicate add-only creation and stale revision.
6. Starts two independent writers to the same revision; exactly one
   succeeds under IndexedDB readwrite transaction serialization.
7. Reopens the journal and verifies the winner did not overwrite the
   first previously committed result.

The existing CDP runner gains an *optional* v8 result-marker argument;
its default v7 behavior and the old v7 fixture are unchanged.
Browser smoke CI now executes both the legacy v7 and new v8 fixture
using real Chromium on Ubuntu, Chrome/Edge on Windows and SafariDriver
with actual Safari on macOS. This is distinct from, and stronger than,
prior in-memory IndexedDB unit modeling.

**Boundaries:** real browser navigation and transactional concurrency
do not prove durability after OS power loss, storage eviction, 240
fixture load, low-quota operation or malicious client tampering.
Source referee/medical facts remain synthetic caller assertions, not
authenticated real decisions. No playable M2 career, automatic
sanctions, condition/fatigue posting or accepted statistical
calibration. M1 P4 #30 and exit #3 remain OPEN.

## Same-checkpoint physical medical recovery (2026-10-18)

Native browser smoke now commits **two independent v8 results before real
page navigation**: the existing single ordinary home-side temporary exit
and return, plus a second match with simultaneous home/away outfield exits
at the same 300-second checkpoint and returns at the next checkpoint.
The reloaded, independently source-replayed IndexedDB schema-4 journal
must retain both results, four ordered medical actions with exact timestamps,
and their credited penalty/defending-own-goal statistics. Two independent
concurrent writers then race on the *next* revision; exactly one may commit,
without overwriting either earlier medical fixture.

This tests serialization/replay of the v8 P3 multi-player medical extension
in real Linux Chromium, macOS Safari and Windows Chrome/Edge under the
existing smoke CI. It does **not** test true medical authority, continuous
clock, arbitrarily low browser quota, abrupt OS crash or M2 gameplay.
Historical M0/v3-v7 stores and the v8 result-journal schema are unchanged.
