# M1 P5 v73: low numeric seed sensitivity in xorshift32-v1

The source model uses `xorshift32-v1` with exactly five RNG draws in
each of eighteen 300-second phases. The first draw selects possession,
which is compared to a tactical home possession threshold constrained to
[0.27,0.73]. The source-replayed P5 research cohorts to date have
reused contiguous seed IDs 1..128 across up to 32 fixtures.

A direct deterministic inspection of the existing RNG demonstrates
that for **all 128 low seed IDs**, the first possession draw lies in
[0.000062950188,0.008057685569], below **every permitted** tactical
home possession threshold. Therefore **all** original low-seed games
begin with a home-possession first phase; fixture variation does not
remove this artifact. This is a finite corpus structural bias, **not**
an estimate of actual league home advantage or a claim that the
production RNG is categorically defective.

v73 maps seed indices 1..128 through a pinned domain-separated SHA-256
digest and takes the first 32-bit big-endian word as the actual,
nonzero `xorshift32-v1` seed. This is NOT a change of the game RNG
algorithm or persisted seed format. A matched 8-fixture x 32-index
research exercise compares original low numeric seeds to the
mapped seeds using the exact same opt-in v69/v70 full v29 source
replay and internal model xG. It records rejected outcomes separately,
and measures original/mapped first-draw distribution, shots,
open-play goals and internal xG.

The original cohort's known 256-case reference is 1,972 shots,
303 open-play goals and 355.386 internal model xG (v68/v71 hosted
results). The mapped run is a **different random sample**, not a
shot-for-shot counterfactual within the same RNG stream.
No cross-group equal-acceptance assumption, external real-world
calibration claim, independent observations, or causal attribution is
justified. Seeds share fixtures and synthetic rosters.

No game engine code, normal UI/API, deterministic source replay,
RNG draws, original seed semantics, save/CAS version, 2024/25 holdout
or source catalog is changed. P5, P3 and two complete repository-wide
M1 exit audits remain OPEN; P4 deferred; M2 forbidden.
