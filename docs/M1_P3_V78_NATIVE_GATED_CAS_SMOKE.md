# M1 P3 v78: actual-browser admission CAS smoke

This **development-only** fixture tests the previously merged v76 opt-in
source-gated medical/discipline journal commit in real native browser
IndexedDB. The source schema remains 6 and M0 initial career is unchanged.

The real browser performs a guarded first commit, navigation/reload,
complete source-replayed journal verification, stale CAS rejection,
forged match-result rejection and two competing same-revision guarded
writers. Exactly one of the two competing writes must win, preserving
all previously persisted source facts. Invalid inputs must not mutate
the journal. Native hosted smoke is wired into Linux Chromium,
Windows Chrome/Edge, and macOS Safari workflows.

This does **not** test physician authentication, exceptional IFAB Law 5
return authorization, a production UI or complete crash/power-loss
durability. The low-level v32 journal path remains available and
must not be used as an ungated gameplay write. Browser quota,
same-revision corruption and modelled medical hold already have
separate deterministic fake-IDB/domain coverage in v75/v76. No RNG,
external source licensing, or save-schema change is introduced.

P3 #29 OPEN; P5 #31 OPEN; P4 deferred. Two full repository-wide
M1 exit audits #3 still required; M1 OPEN, M2 prohibited.
