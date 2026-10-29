# M1 P3/P5 v99 - new versioned intraphase shot event source (isolated)

The original v8 physical-XI match calls a seeded one-shot
source at most once in each of 18 five-minute checkpoints.
This makes the observed external RPL 2025/26 reference
average of 23.1167 shot attempts **unattainable** under
the old source and its schema, regardless of parameter tuning.

v99 begins a new explicitly versioned source,
`src/core/m1-v99-intraphase-shots.ts`, with **three physical
shot opportunity slots per 300-second tactical checkpoint**.
The v99 event schema is separate (99); shot running seconds
are `phase*300 + slot*100 - 1` for slots 1..3,
giving 99, 199, 299, etc. IDs are
`m1-v99-shot-{phase}-{slot}`, sequences are monotonic
and a distinct full-time event is emitted at second 5400.

The source validates the original M0/M1 prematch, eligible
starting players and assigned actor policy before simulation.
It reuses the already-tested public
`computeM1V5PhaseShot` shooter/tactical/quality source
unchanged, consumes five xorshift32-v1 RNG draws at each
of the 54 opportunities (270 total), and advances the same
authorized team tactical clock exactly once every 300s.
Every shot participant must be on the original verified XI,
not a goalkeeper or phantom reserve. Shot outcomes, on-target
and source xG update a separate v99 result only.
`verifyM1V99IntraphaseShots` replays the entire source
from original inputs and rejects all modified events, seed
continuations, scores, participant IDs or timestamps.

**Critical integration boundaries**: this is an *isolated
source prototype*, not a playable v76 fixture. It does
not yet replay user/staff substitutions, medical exits/returns,
on-field red dismissals, referee foul/penalty decisions or
own goals at these new 100-second opportunities. A caller
cannot persist a v99 result in existing schema-6 CAS and
cannot claim physician, KDK or external referee authority.
A new event source must integrate each physical transition
and verified virtual-time referee command before it can
be adopted into the durable career, and must introduce
new version-aware CAS admission.

Since legacy v5 `shotOutcome` currently has high model
xG/on-target and conversion compared with independent real
reference, v99's more frequent chances are **not calibrated**.
This PR does not alter any probabilities or represent
successful P5 release realism. It only establishes source
chronology, physical starting-XI eligibility, full
deterministic replay, and the independent schema boundary.
A separate future statistical experiment should jointly
optimize chance frequency, target and goal quality
*after* event-law integration and then use the untouched
2024/25 holdout.

Tests cover source parity on rerun, all 54 possible slot
times, participant eligibility, long-run >18-shot cases
demonstrating the new source's expressivity, exact RNG
draw conservation, forged score/times/IDs/participants/
source denial, legacy state nonmutation, and refusal to
persist or claim unsupported sanctions.

P3 #29 and P5 #31 OPEN; P4 #30 deferred; exit audit #3
requires two full repository-wide passes. M1 OPEN,
M2 prohibited.
