# M1 P5 v64: explain v29 failed source-replay attempts

The hosted 4096-attempt v29 diagnostic returned **882 rejected
cases (21.53%)**, labelled \`SOURCE_MATCH_REJECTED\` without revealing
which lower-level referee/medical timeline invariant failed. Treating
those cases as 0:0 would conceal bias; silently dropping them creates
an accepted-only, potentially selected population.

This opt-in diagnostic adds an independent call to a special v29 source
replayer which can capture the **typed lower-level referee rejection
code** as the current engine executes. It never changes normal match
results, event ordering, PRNG draws or persisted data. It does not
alter the production v29 error object; only the new explicit
\`diagnoseM1V29SourceFailure\` API exposes the cause.

The bounded script uses the actual synthetic 16-club catalog, fixed
fixture IDs, and fixed seeds with strict 64-seed by 8-fixture maximum.
It double-checks that the original v29 returned the same rejection
before counting a lower-level root cause. All successful games, missing
roots and rejection categories remain separate. Every case is
fingerprinted in a reproducible SHA-256 digest. Output contains no
player IDs or untrusted raw source rows.

The hosted PR CI research job (not a release performance or realism
gate) executes a finite seeded sample and records category counts.
If a root cause points to a genuine mismatch, fixing that issue will
be a **separate replay-differential PR** with frozen prior snapshots.

No calibration acceptance, medical diagnosis, external referee authority
or 2024/25 holdout is implied. P5 and M1 exit remain OPEN; M2 forbidden.
