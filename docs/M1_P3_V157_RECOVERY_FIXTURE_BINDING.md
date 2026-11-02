# M1 P3 v157 — bind synthetic recovery to original fixture

The v118 modelled-recovery projector regenerates the original fictional v19
referee stream and compares every source command. A direct caller could
previously retag both the journal item's outer `fixtureId` and every
`plannedCommands[*].fixtureId` while leaving the source prematch fixture
unchanged. The commands would still compare to the projector's outer-ID-based
expectation, incorrectly attributing the genuine injury to another fixture.

Require `recreated.fixtureId === item.fixtureId` before deriving any
recovery. A fixed-seed test preserves a genuine replay-verified synthetic
injury, rejects combined and single-field retags, verifies the whole v8
journal also rejects the forged item, and preserves the genuine projection.

This is defense in depth for direct projection; it does **not** replace
complete untrusted-journal validation, authenticate external referee or
medical evidence, implement KDK sanctions, or certify clinical clearance.
No RNG, playable probabilities, source schema, saved career, UI, rights or
2024/25 holdout change. P3 #29 (4 blocks), P5 #31 (5 blocks), M1 and exit
audit #3 (0/2 full passes) remain OPEN; P4 deferred and M2 prohibited.

Run after `npm ci && npm run build:core`:

```bash
node --test tests/m1-v157-recovery-fixture-binding.test.mjs
```
