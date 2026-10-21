# M1 P4: v32 atomic causal medical journal (schema 6)

**2026-10-21. Experimental in-memory journal for v29/v31; not
certified clinical/disciplinary history and not durable browser CAS.**

The existing `M1V26Journal` schema 5 accepts v23/v24 source. It must
**not** be repurposed to store v29 causal medical treatment decisions,
because the v29 physical XI, patient choice, source event chronology,
and shot outcomes may differ from the historical v23 run for the same
fixture and seed.

`src/core/m1-v32-causal-medical-journal.ts` provides an independent
schema-6 journal with the same immutable M0 initial-career/catalog
boundary and fail-closed command/revision/fixture semantics. Every
untrusted source row is fully replayed from the original career
catalog through v29 then v31 before any journal read/apply is accepted.
A batch of 1..16 fixture results is built purely in memory; a failed
later match cannot partially modify preceding accepted state. Wrong
career, unknown/duplicate fixture, duplicate command, stale revision,
invalid source tree, unsupported engine rule, altered card/victim event,
modified physical-time result and poisoned older row all fail closed.

Stored projection data includes actual source-derived physical seconds,
per-player shots/goals/modelled cards, exits and returns, modelled
medical decision-to-incident associations, score and RNG continuation.
The source includes deterministic prematch, tactical policy and
admitted coaching commands, **not a second editable catalog**.
The claimed full v31 result is never taken on trust: it is re-derived
byte-for-byte before the normalized facts are committed.

Schema 6 is **not** an implicit migration of schema 5: old v26 journals
are not accepted as v32 records, old browser DBs and initial career
saves remain unchanged. No browser storage is added by this version;
the next P4 increment must implement an isolated native IndexedDB
read-modify-write CAS with real browser tests and a measured latency
budget.

Every row explicitly reports no authenticated medical need, no
external clinical/referee authority, no calibrated fatigue,
no certified intermatch bans, and no official league points.
This is coherent seeded football model bookkeeping, not reliable
fitness or a real-football medical data source. P3 #29, P4 #30,
P5 #31 and M1 exit #3 remain OPEN; M2 prohibited.
