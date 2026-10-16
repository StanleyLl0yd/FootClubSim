# M1 P3/P4: JSON preflight for interrupted-match snapshots

**Scope: experimental pure headless referee interruption snapshot, not a
legal ruling, a finalized match or career posting.**

The v8 interruption API now uses the same `isPlainJsonTree` predicate as
the v8 source journal and ordinary pause/continue checkpoints. Before
looking at `elapsedSeconds` or running the synthetic evaluator, it rejects
commands, referee decisions and medical actions that contain accessors,
`toJSON` methods, array holes, repeated aliases, cycles, hidden/symbol
fields, custom prototypes or non-finite values. An invalid stream
returns `FUTURE_ACTION`, preserving the existing typed failure channel.

`verifyM1V8InterruptedMatch` also rejects non-JSON candidate snapshots
before recursively comparing their fields to a recomputed source replay.
Malformed candidate objects cannot invoke getters while claiming a
previously observed interruption. Valid plain JSON snapshots retain the
same event prefix, score, RNG cursor and separate physical-XI state as
before.

**Not included:** external authentication of referees, actual stop/restart
signals, VAR, appeals, abandonment decisions, official result posting,
storage durability, malicious JavaScript Proxy sandboxing, or permission to
resume or score an interrupted match. No M0/v3-v8 saved schema, current
match engine or M2 user interface is changed. M1 #29/#30 and exit #3
remain open.
