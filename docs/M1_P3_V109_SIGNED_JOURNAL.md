# M1 P3 v109: versioned independently replay-validated signed source journal

This is a **pure research-domain proposal**, not career persistence or
authentication of real referees and clinicians.

- A new schema-109 journal is distinct from M0, schema-6 backup/restore,
  legacy v7 match-result journals and other historical source formats.
- Bind the immutable M0 starting pack ID/version, selected club and career ID,
  independently supplied trusted Ed25519 public key **ID**, signed
  v105 source fixture and exact sequential expected revision.
- On load reverify every stored v107 signature, source SHA-256, exact v105
  outcome and original fixture/catalog. A caller-supplied journal is never
  treated as proof by itself.
- A new signed entry requires unique challenge and fixture IDs. Duplicate,
  stale, mismatched source, unknown fixture or altered M0 data fails closed.
- Incoming raw entry data is snapshotted before asynchronous cryptography.
  No mutation of saved legacy journals, production RNG or app UI occurs.

## Important limits

This does **not** independently enroll trusted issuer keys, prove referee or
clinical authority, provide a globally issued challenge namespace, guarantee
anti-rollback against an attacker rewriting all local browser data, or
atomically persist an accepted record. The simulated v105 source still
contains unimplemented exception/referee paths. The input public key
and key ID are trusted only by an external host contract that is not
implemented here. The maximum journal payload is bounded.

```bash
npm ci
npm run build:core
node --test tests/m1-v109-signed-journal.test.mjs
```

Next: implement single-transaction IndexedDB CAS against the exact
prevalidated current journal and immutable M0 source, crash-safe reload,
stale-writer and quota tests. Do not insert `await` inside an active
IDB transaction. Then implement independent issuer enrollment/challenge
anti-replay and real regulatory decisions before any P3 acceptance.

P3 #29, P5 #31, M1 and exit audit #3 OPEN; P4 #30 deferred;
M2 prohibited.
