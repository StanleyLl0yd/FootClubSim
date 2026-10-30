# M1 P3 v107 - exact-source signed v105 pre-admission

This **opt-in research-only** gate cryptographically binds an entire v105
source (prematch including catalog, policy, planned commands, checkpoint
medical source, arbitrary-second medical source and special-goal decisions)
to a host-supplied Ed25519 public key. A signed SHA-256 digest is scoped to
the career, fixture, expected revision and challenge ID, with an explicit
versioned purpose string. The independent v105 simulator replays the
physical/medical/source chronology and the claimed result must match exactly.

A signature proves only possession of a private key corresponding to the
**externally configured public key**. It does NOT establish that the signer
is a recognized referee, physician, match controller or disciplinary body.
The host, not the editable career, must independently provision and pin
trusted keys, issue non-reusable challenges, verify the current career
revision, enforce signed source permissions and load immutable M0 data.

The API deliberately reports all four of those missing lifecycle controls
as `false`. There is no schema-6 migration, no IndexedDB CAS admission,
no M0 rewrite, no release calibration and no M1 exit acceptance.

Test:

```bash
npm ci
npm run build:core
node --test tests/m1-v107-signed-v105-source.test.mjs
```

P3 #29 remains OPEN pending actual trusted referee/clinical authority,
interruption and exception rulings, version-aware immutable M0/source journal,
both-club sanctions, browser-native atomic exact-snapshot CAS and acceptance.
P5 #31 / M1 / exit audit #3 OPEN; P4 #30 deferred; M2 prohibited.
