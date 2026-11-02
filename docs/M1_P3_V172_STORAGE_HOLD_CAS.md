# M1 P3 v172 — storage transaction rejection of fictional hold bypass

An isolated IndexedDB transaction stub runs the actual v120 browser-store
entrypoint against a fixed-seed, source-replayable v166 attack that illegally
reintroduces a previously held player. The test checks the typed
`ELIGIBILITY_REJECTED` refusal, zero attempted `put` calls, an unchanged
persisted revision and successful subsequent legal continuation; a stale CAS
retry remains rejected. This strengthens the v171 pure admission test.

The stub deliberately is **not evidence of real Chrome/Edge/Safari IndexedDB
behavior**, power loss, quota/eviction recovery or a 240-match workload.
Those platform and full-season gates remain open. P3 0/4, P5 0/5,
exit audit #3 0/2; M1 OPEN, M2 prohibited, 2024/25 holdout sealed.
