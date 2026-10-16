# M1 P5: deterministic v8 source-integrity mutation campaign

**Status: engineering regression only, NOT match calibration, not a
statistical or security proof.** This campaign exercises the isolated v8
schema-4 verified career journal without changing its format.

The bounded `tests/m1-v8-adversarial-source.test.mjs` corpus creates
four independently simulated synthetic fixtures with source-claimed medical
treatment exit/return, one scored penalty and one defending own goal each.
A fixed xorshift32 sequence selects 80 corruptions from 20 distinct
source/journal/output mutation types: RNG continuation, result counts,
fixture identity, player attribution, named bench, source medical/referee
streams, invalid planned commands, revision labels and schema shape.
Every corruption must fail the untrusted journal full-source replay.

It separately verifies that a poisoned previous journal cannot be used as
a base for a new atomic batch, that the valid journal can still advance,
and that sparse arrays, cycles, non-finite fields and undefined extra
fields fail closed without changing trusted inputs. A tampered asserted
match result in the middle of a batch must not commit the first item.

The tests are intentionally **bounded and reproducible**. They do not
provide arbitrary fuzz-code coverage, authorization for referee facts,
medical clearance, real-world sporting baselines, full browser storage
durability or a performance threshold. This is partial progress towards
M1 P5 #31; milestone exit #3 and M2 stay blocked.
