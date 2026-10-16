# M1 P1/P4: strict JSON preflight for v8 pause/continue sources

**Scope:** source-integrity hardening only; not a change to match results,
replay semantics, fixture settlement, authentication or M2 gameplay.

The pre-existing v8 schema-4 journal hardened its saved-data validator in
PR #240. The ordinary pause/continue checkpoint previously checked action
times and used JSON.stringify to clone action arrays after simulation. A
malformed in-memory object with an accessor, `toJSON` method, hidden field,
array hole or cycle must not be trusted as serializable referee/coach source
data: serialization can invoke user code or omit significant input metadata.

The new small `isPlainJsonTree` pure helper centralizes the already-enforced
journal predicate and is called:

1. By the journal before cloning candidate saved data, preserving the
   existing validation and replay semantics.
2. By `createM1V8PhaseCheckpoint` before it inspects action times,
   runs the evaluator or clones its command/medical/referee arrays.
3. By `resumeM1V8PhaseCheckpoint` before reading an untrusted previous
   checkpoint's own fields or examining newly supplied actions.

Rejected malformed checkpoint input returns `INVALID_CHECKPOINT`; malformed
action arrays return `INVALID_SCHEDULE`. They do not result in calling
getters or `toJSON` code. All admissible ordinary JSON checkpoints retain
the existing schema, event order, RNG metadata and pause/continue behavior.

This only protects values passing through these two entrypoints; it is **not**
a cryptographic signature, external medical/referee authority, malicious
Proxy confinement, browser storage durability, referee stoppage/VAR handling,
or whole-game eligibility verification. Test scenarios explicitly check
historical replay equivalence and malformed source types. M1 remains OPEN,
and no M2 work or saved-career migration is authorized.
