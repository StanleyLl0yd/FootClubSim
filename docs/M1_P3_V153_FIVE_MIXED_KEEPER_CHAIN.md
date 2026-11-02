# M1 P3 v153 — five normal replacements with chained goalkeeper exit

This regression combines two previously exercised paths in a **single**
source-replayed fixture: starting keeper -> reserve keeper A at 900 simulated
seconds, reserve keeper A -> reserve keeper B at halftime (2700), and three
additional outfield substitutions at halftime, 3300 and 3900 seconds.
It consumes five legal ordinary replacements, but only three in-play
substitution opportunities (900, 3300 and 3900); halftime is exempt.

The test checks distinct strict-JSON command actor objects, ordered exact
participant/clock/stoppage replay, native journal application, v126 immutable
source verification, and continuation. It rejects illegal keeper re-entry,
duplicate/previously used bench players, a fourth in-play opportunity, reversed
time and an aliased non-tree source actor. No new football rule, referee
authority or persistent schema is introduced; the existing v105/v138/v120
engine remains authoritative.

This is **fictional internal referee admission** and an invariant regression,
not verified real IFAB match events, complete opposition source history,
concussion or KDK authorization, release calibration or closure of P3.
Production RNG, historical M0/v8 saves and the unopened 2024/25 holdout are
unchanged. P3 #29, P5 #31 and M1 remain OPEN; P4 #30 deferred, M2 forbidden;
two full repository-wide exit audits #3 remain outstanding.

Run after `npm ci && npm run build:core`:
```bash
node --test tests/m1-v153-five-substitution-mixed-keeper-chain.test.mjs
```
