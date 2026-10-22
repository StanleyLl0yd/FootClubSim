# M1 P4 v37: native Chromium committed-write process restart

**Research-only, 22 October 2026. Not an OS crash/eviction release gate.**

The independently triggered `m1-p4-v37-native-process-restart.yml`
runs an actual Chromium process with a temporary profile on Linux.
The fixture `examples/m1-v37-process-restart.html` saves an immutable
synthetic M0 career, initializes a distinct schema-6 journal and commits
a source-replayed v29/v31 match through the real v32 IndexedDB CAS.
It then loads and validates the committed result.

The CDP driver waits for an exact post-commit readiness marker, sends
**SIGKILL** to the browser process group, waits for its exit, starts
a **new Chromium process with the same profile**, loads the M0 career and
performs a complete source-replayed schema-6 journal load. The expected
revision, fixture, RNG counts and command ID must all survive.

This proves only that **one acknowledged transaction** survives that
particular hosted Chromium process restart. It does NOT model power loss,
filesystem corruption, in-flight transaction termination, lost browser
profiles, quota eviction, Safari/Windows behavior, medical authentication,
professional archival backup, 240-fixture lifetime or production
availability. No real user saves or existing data formats are modified.
The driver is explicitly Linux/POSIX-only and its temp profile is deleted.

P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN. M2 prohibited.
