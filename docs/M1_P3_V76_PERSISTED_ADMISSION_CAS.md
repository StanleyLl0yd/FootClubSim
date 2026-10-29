# M1 P3 v76: persisted medical admission and same-snapshot CAS

v75's opt-in precommit medical/disciplinary admission now has an optional
**durable IndexedDB commit path** under the existing isolated schema-6
`footclubsim-m1-v32/result-journals` store. This is a P3 integration and
does not expand or alter deferred P4's general-purpose batch API.

`commitM1V76PersistedMedicallyGatedFixture(careerId,expectedRevision,request)`
loads the immutable M0 career, reads a complete journal snapshot, and runs
v75 source-replayed admission before a write transaction. A single IDB
readwrite transaction compares **the entire exact journal snapshot**, not
only the revision, then writes the source-gated journal once. Same-revision
payload alterations, stale revisions, medically held participants, forgeries,
quota failure and concurrent writers fail closed. No asynchronous await or
expensive source replay runs inside the write transaction.

The old `commitM1V32PersistedBatch` remains available unchanged for historical
and adversarial tests, so this is **not yet enforced for all callers**.
No production UI path has been connected. The M0 career and saved schema-6
format remain unchanged. Clinical diagnosis, doctor signature/clearance,
KDK/referee authority, exceptional Law 5 treatment admission and eventual
recovery logic are not established by these synthetic checks.
Browser process/OS storage loss, eviction and cross-device durability require
separate validation; transactional completion is not a backup guarantee.

Regression tests include successful reload, same-revision tampering,
two-writer concurrency, quota rollback, result forgery, stale revision, and
source-replayed medical hold. CI browser matrices continue to cover the
pre-existing storage path; a new native v76 page-level acceptance is not
yet asserted.

P3 #29 stays OPEN; P5 #31 stays OPEN. P4 #30 deferred.
Exit audit #3 requires two full repository-wide passes. M1 OPEN; M2 prohibited.
