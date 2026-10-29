# M1 P3 v66: ordered goal kick-off followed by a generated foul

The 256-case v65 hosted diagnostic recovered 17 rejected cases.
All 17 had an identical lower-level cause: goal restart and generated
foul share a coarse running-second timestamp.

[IFAB Law 8](https://theifab.com/laws/latest/the-start-and-restart-of-play/)
confirms the ball becomes in play once kicked and clearly moving after
a goal restart; [IFAB Law 12](https://theifab.com/laws/latest/fouls-and-misconduct/)
requires the ball to be in play for a free kick against an offence.

This change accepts only *source-ordered* synthetic sequences. The
v23 underlying v8 source records a goal-whistle at second T-1 and the
explicit restart-kickoff at T. A separately generated foul at T is
processed strictly after that kickoff. The source referee reconstructor
fails closed if the required restart event is missing or appears after
the foul whistle. No event is deleted, no hidden resampling is used,
and the relative RNG draw streams remain unchanged. Chronology within
one coarse second is event-ordered, NOT measured physical milliseconds.
All other unsupported referee/coach commands remain rejected.

A fixed 8-fixture x32-seed test discovers a formerly rejected collision,
asserts goal -> kickoff -> foul -> foul-restart source chronology,
verifies full match replay and identical repeat runs, and rejects an
adversarially forged source timeline. The historical v65 diagnostic
fingerprint and categories remain evidence of the previous rejection.

Game simulation is a virtual model, not proof of official RPL decisions.
No medical authority, match authenticity, real-world injury frequency
or independently accepted realism is inferred. Existing M0 and
schema-6 saved journals are not migrated. #29/#31 and M1 exit remain
open. M2 prohibited.

## Full replay differential evidence

The additional opt-in hosted matrix runs the identical four v62
disjoint fixture windows (32 fixtures x 128 seeds = 4096 attempts)
after this narrowly scoped source chronology change. Every shard
asserts source replay, conserved denominators and non-increasing
rejection count against its own independently archived pre-fix
reference: [219, 217, 223, 223] rejected. It records each
post-fix deterministic SHA-256 and number of recovered matches.
These are deterministic synthetic regression facts, not a proof of
realistic football score distributions.
