# M1 P5 v160 — replay-verified playable v120 metric categories

The existing **v155 full-calendar synthetic research** measures the
separate v104 candidates, not the actual dense playable v105/v120
career journal. This read-only v160 adapter accumulates metrics from
the **exact v120 journal after complete source verification**, rather
than accepting a supplied summary or tuning a previous research model.

Per recorded controlled-club fixture and **for both participating
teams**, it accumulates `goalsAllTypes`, `openPlayGoals`,
`penaltyGoals`, `ownGoalsFor`, `penaltiesTaken`,
`shots`, `shotsOnTarget` and `openPlayXgMilli`.
It independently checks the per-team conservation
`goalsAllTypes = openPlayGoals + penaltyGoals + ownGoalsFor`,
shots/on-target arithmetic and final home/draw/away and nil-nil
totals. Invalid prior journal, altered result or stale revision
is rejected by v120 source replay before reporting anything.

**Scope is not RPL-wide:** a v120 career records only the selected
club's fixtures, so the two-team rows may contain repeated opponents
and do **not** represent 240 independent league matches. This is
not an xG model for penalty kicks or evidence that provider definitions
for shots, on-target blocks, cards, injuries or goals are equal to
ours. The schema exposes those compatibility flags as `false`;
no real data or 2024/25 sealed holdout is touched.

This is P5-1 / P5-2 **functional measurement infrastructure**, not
P5-1 acceptance, independently harmonized calibration or any of
the nine completed M1 closure groups. M1/P3/P5 and exit #3 (0/2)
remain OPEN. P4 deferred, M2 prohibited. M0, existing v8/v120
journals, source replay, PRNG and normal match probabilities are
unchanged.

Run after `npm ci && npm run build:core`:

```bash
node --test tests/m1-v160-playable-metrics.test.mjs
```

Next: integrate lawful versioned real event definitions, full
two-team league fixture chronology, independent matched-cohort
uncertainty and explicit preregistered tolerances. Never call
v160 counts an official RPL comparator solely because the field
names appear similar.
