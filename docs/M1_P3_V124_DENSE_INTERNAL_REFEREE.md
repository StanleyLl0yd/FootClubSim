# M1 P3 v124 — fictional referee incidents in the dense source

The existing v19 virtual referee uses a separate fixed-budget RNG stream
and generates source-replayable caution, straight-red and speculative
noncontact injury-withdrawal incidents. This isolated opt-in adapter
constructs commands entirely from a fresh v19 replay of the immutable
M0 prematch, rather than trusting user-supplied cards or medical
permission strings. It submits the exact incident list to the
100-second physical v103/v105 source, validates resulting on-field
effects, and returns a schema-120 request for the separate v120 career
journal. The full journal and generator commands can be independently
reconstructed and compared to reject fabricated incident identifiers.

The source identity is now checked at **both v120 write and replay**:
the virtual v124 namespace requires the exact canonical fixture seed
from the immutable career, exact regenerated incident commands, and no
unrelated medical or goal adjudication payload. Even an otherwise
replayable event list with a substituted fixture RNG seed fails closed.
Older unverified event namespaces do not become authenticated by this
check. No original career RNG, save schema or generated football event
probabilities are changed.

The adapter **does not** accept clinical evidence or authenticate
real-world referee/KDK decisions. A virtual injury is an uncalibrated
fictional event, not a diagnosed condition or medical clearance.
Crucially the bounded v122 ordinary-only continuation fails closed
after *any* incident-bearing match. Until cross-fixture sanctions and
medical recovery are independently supported for this new dense
source, a later match cannot silently restore a suspended or injured
player. Standalone v8 v118 recovery remains separate; never infer
that its schema applies to a v120 journal.

Unit tests validate a real deterministic incident from a fixed seed
sweep, exact v120 source/replay, unchanged original M0, forged source
rejection and blocked next-match ordinary continuation.

Future P3 work: full v120 intermatch eligibility (one-match bans,
caution aggregation, conservative medical clearance), valid substitutions
during the dense clock, appropriate referee/restart authentication and
exception handling. P5 must still measure source-compatible shots, xG,
goals, cards/injuries against independent, definition-aligned references.
2024/25 holdout unused. P3/P5/M1 OPEN; P4 deferred, M2 forbidden,
full exit audits #3 0/2.
