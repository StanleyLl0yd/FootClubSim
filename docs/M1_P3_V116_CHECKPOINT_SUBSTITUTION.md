# M1 P3 v116 — manager-selected substitution checkpoints

A manager may now select the outgoing and incoming outfield players **and**
the virtual-time checkpoint of a normal substitution in the existing browser
playtest. The default remains 300 seconds (fifth minute) for existing API
callers. No M0 or v8 persisted journal schema is changed.

Allowed virtual times are 300..5100 seconds in 300-second steps.
The 2700-second (45-minute) boundary uses `half-time`; other checkpoints
use the test scenario's `referee-authorized` field. This is a **fictional
authorization assumption**, not a real authenticated referee stoppage.
The engine's normal substitution admission and full source replay still apply.

Tests: chosen 900- and 2700-second checkpoints, replayed persisted source
and strict rejection of malformed/off-grid/full-time values. Native Chromium,
Windows Chrome/Edge smoke now chooses 900 seconds and reads back the recorded
time, participants and stoppage from IndexedDB CAS across browser restart.

This is a bounded synthetic M1 playtest, not full live pause/command handling,
real-world medical authority, full competition referee exceptions, P3
acceptance, M2 authorization or completed P5 statistical calibration.
The holdout 2024/25 is untouched; full exit audit #3 remains 0/2.
