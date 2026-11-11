# M1 P4: condition from source-replayed match minutes

Implementation: `src/core/m1-v188-condition.ts`, `src/core/m1-v188-league-source-journal.ts`.

## Functional effect

- Every validated 240-fixture journal entry yields physical on-field seconds
  for both teams from the existing v179 source clock, including substitutions,
  dismissals, medical exits and returns.
- A **versioned** `conditionPolicyVersion: 1` on new fixture requests and
  persisted source entries applies fictional, integer 35–100 condition.
  Each player's own next fixture grants a capped recovery step; only their
  actual physical seconds create workload. Recovery and workload use the
  initial catalog's unmodified stamina/natural-fitness attributes. Goalkeepers
  receive a smaller workload. The same original season seed and source match
  generator remain authoritative.
- Automatic registered lineups for **both teams** now prioritize the
  modelled condition along with existing stable registered order, while
  preserving the v96 11-player, goalkeeper, 7-foreigner and bench legality
  rules. Subsequent season match outcomes can therefore change through
  **real rotated on-field players**, not a decorative UI number.
- A coach may explicitly select an eligible tired player. The manager's
  most recent legal XI/tactics are still remembered. This version does
  **not** yet scale individual in-match performance by condition; it affects
  automatic selection, and never silently overrides a manual XI. The coach's
  lineup editor shows next-match readiness estimates.
- Exposure, condition and recovery are deterministic and recomputed from
  verified journal history. The original M0 catalog, career seed, journal
  schema 188, source engine, match commands and storage CAS are unchanged.

## Version 2: source-verified effective match performance

Future prepared matches now use `conditionPolicyVersion: 2`. The source
generator, special-goal engine and their independent source replay receive a
**transient** effective-ability projection for both sides: lower readiness
reduces relevant football attributes by at most 19.5% before rounding.
Natural fitness, leadership, teamwork and aggression retain their original
catalog values; player identity, contract, roster and recovery do not mutate.
The original, unadjusted M0 catalog is still the only catalog accepted in
the authenticated v188 request and stored source prematch. The generator's
projection is computed again, rather than read from an untrusted saved field.

The original PR #521 introduced condition source v1 (automatic rotation).
This follow-up permits monotonic 1 → 2 upgrades, never 2 → 1, and
replays both versions exactly. A saved v1 fixture does not acquire v2
match penalties retroactively. No stochastic draws are added.

## Replay and compatibility

The condition flag is optional on **legacy** v188 entries, so earlier
careers replay under their exact source model. A newly prepared match opts
into v2 condition; after the first v1 or v2 entry, subsequent entries
may not downgrade. Earlier v1 entries still replay by v1 rules. Full replay of every entry verifies the lineup used
against the condition state from **its preceding verified fixtures**.
Commit verification recomputes both the result and the condition transition;
it never trusts a posted condition score. Cached verified prefixes bind the
immutable initial career, exact journal bytes, fictional holds and condition
state. Any broken physical chronology fails closed.

## Important limitations

This is a provisional **fixture-step** model. It is not measured calendar
days, travel/training stress, diagnosis, official injury clearance, a
clinical suspension or licensed real-world match calibration. It does not model minute-by-minute
performance deterioration within a match, morale or official post-match
injury recovery. It is not M1-P4 acceptance in isolation.

Verification gates include unit tests for minutes-driven condition,
recovery, roster rotation, replay, immutable legacy prefixes, downgrade and
invalid-source rejection. Full browser and source-replayed season CI must
pass on the exact PR head before merge; untouched sealed 2024/25 holdout.
