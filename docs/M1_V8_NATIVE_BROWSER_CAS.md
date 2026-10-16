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
