# M1 P3 v75: same-revision source-gated precommit path

This is a new **opt-in in-process** higher-level entry point for
the v63 modelled medical withdrawal gate plus v58 both-club source
discipline check, followed by an atomic one-match v32 source-journal
append at the exact same expected revision.

The proposed v32 command is untrusted. All input must be plain JSON.
The existing v32 journal is fully source replayed. The v63 gate
rejects a currently held player in starting XI **or unused bench**,
and adversarial historical reappearance; v58 checks both clubs'
prior automatic card sanctions. Only the source-verbatim v31 result
that v63 just produced can be appended to the source journal.
No side effect occurs on a denied gate, stale CAS revision, tampered
result or source append rejection.

**Limits:** the old low-level source journal API intentionally remains
available for history validation and adversarial tests. This wrapper
does not force every future UI/caller to use it, and does not commit an
IndexedDB transaction: the browser needs to integrate this gate under
one actual storage CAS boundary. Authentic doctor, real RFU/KDK
sanction and referee sources, medical clearance timing, exception
paths, and recovery remain unresolved. No authority, clinical
calibration or genuine real-world injury is inferred from the
synthetic withdrawal. The return flags explicitly preserve this.

M0 and saved schema-6 are unchanged. P3 #29 remains OPEN. P4 deferred,
P5 #31 and M1 audit #3 OPEN, M2 prohibited.
