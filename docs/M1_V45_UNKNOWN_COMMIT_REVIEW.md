# M1 P4 v45: source-replayed classification of unknown CAS outcomes

**Research-only, M1 OPEN. Not a production recovery UI or authorization.**

After a Worker dies, times out or returns an unusable reply, the
caller MUST NOT infer that IndexedDB rolled back. This isolated pure
review function classifies one **already persisted** journal snapshot
against the original attempted batch, without mutating any database.

`reviewM1V45PotentialCAS(initial,journal,claim)` validates the entire
schema-6 history from the immutable M0 career, replays the proposed
batch against the exact historical prefix and compares every derived
appended result to the current replayed journal. It reports:

- `OBSERVED_COMMITTED`: the exact model-replayed batch is present at
  the expected revision, possibly followed by later valid fixtures.
- `NOT_OBSERVED_AT_READ`: this snapshot is still at the prior revision;
  a racing write could finish later, so this is NOT proof of rollback.
- `DIVERGENT_HISTORY`: another valid result occupies the expected
  position, a partial/misaligned history is seen, or revision is behind.
- `INVALID_CLAIM`, `INVALID_SOURCE`, `CORRUPTED_HISTORY`: typed
  fail-closed errors; do not silently repair or retry.

Every outcome sets `automaticRetryAllowed:false`, including a
positive observed match. The caller must make a separate authoritative
read before interacting with the journal; a UI should never claim
an unacknowledged operation committed based solely on a Worker reply.
The function is read-only and does not add a stored schema or mutate
the existing CAS module.

Checksums and model source replay do NOT authenticate football referee,
medical or discipline decisions. The observation is local and does not
establish OS power-loss durability, eviction immunity or a
cross-tab/cross-device transaction coordinator.

P3 #29, P4 #30, P5 #31 and M1 exit #3 OPEN; M2 prohibited.
