# M1 P4: interrupted medical-aware event prefix (isolated v8)

**Status: synthetic experiment, no accepted interruption/resumption rules.**

`src/core/m1-v8-interruption.ts` exposes a new read-only schema-1
interrupted match snapshot for engine 7/event schema 8. Only checkpoint
boundaries **300 through 5100 seconds** are supported by the current
300-second virtual phase clock. An interruption rejects any source
command, referee decision, medical action or observed treatment-restart
timestamp that lies at or after the checkpoint.

Before forming the prefix, the full bounded v8 deterministic evaluator
revalidates *the supplied already-known action history*. Any simulated
future phases exist only inside that evaluator and are discarded.
The returned snapshot includes only events before the interruption,
the **provisional** goal totals observed in that prefix, exact PRNG
continuation state after completed phases and the physical XI, including
temporary medical absences at the stop. Since no future source actions
are accepted, the evaluator's final player presence equals presence
at the checkpoint; it is not a forecast of actual future participation.
Seeded verification rejects altered event lists, status, score,
absences, PRNG state or supplied historical sources.

**Never post a result or league points from this snapshot.** There
is no `full-time` event, final report, awarded score, disciplinary
retrospective ruling or restart permission. RFU/IFAB exceptions,
running-clock-level interruptions, approved referee decisions, trusted
physical-medical assertions, actual match resumption and cancellation
remain unresolved. The generated future is not an independently
authenticated future; the snapshot merely reports already elapsed
synthetic phases at their fixed checkpoints.

M0/v3-v7 save formats, the persistent v7 CAS journal and approved
data are not modified. M1-P3 #29, P4 #30 and exit #3 remain OPEN.
No M2 permission.
