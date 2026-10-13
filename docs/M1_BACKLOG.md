# M1 execution backlog (prepared during M0)

**Status:** prioritized planning only. Implementation of M1 must not start before completion and whole-repository two-pass review of M0 [exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2). The tasks here are estimates of relative complexity, not delivery dates.

| Order | Issue | Depends on | Relative effort | Main risk |
| --- | --- | --- | --- | --- |
| 1 | [#27: seeded state machine and replay](https://github.com/StanleyLl0yd/FootClubSim/issues/27) | M0 engine/tactics contracts, #2 | L | Inconsistent PRNG consumption or unversioned events |
| 2 | [#28: chance creation and outcomes](https://github.com/StanleyLl0yd/FootClubSim/issues/28) | #27 | L | Unrealistic or unstable scoring probabilities |
| 3 | [#29: substitutions and discipline](https://github.com/StanleyLl0yd/FootClubSim/issues/29) | #27, #28, verified rules | L | RPL exceptions and changing on-field legality |
| 4 | [#30: match report and single-apply commit](https://github.com/StanleyLl0yd/FootClubSim/issues/30) | #27, #29 | M-L | Duplicate fixture effects on retry or partial state |
| 5 | [#31: calibration, property tests, performance](https://github.com/StanleyLl0yd/FootClubSim/issues/31) | #27-#30 | L | Overfitting to assumptions or using unlicensed baselines |
| Exit | [#3: two-pass full-repository audit](https://github.com/StanleyLl0yd/FootClubSim/issues/3) | all M1 criteria | L | CI/browser and rights evidence gaps |

Relative effort here is qualitative (L > M), not a duration guarantee. Dependencies determine execution order; limited overlap is possible after core event and rule interfaces have stabilized.

## M1 definition of done

- A pure, deterministic event-driven 11v11 match engine that consumes synthetic players, fixtures, lineups, tactical plans, rules version and explicit seed.
- Reports and participant stats derived from the same complete event ledger; no score reconstruction from separately sampled aggregates.
- Cards, injuries, penalties, substitutions, own goals, fatigue and validated competition-specific exceptions modeled coherently with an explicit event version.
- Reproducible calibrated statistical tests with documented source permissions and uncertainty, honest empirical results, and bounded simulation time.
- Whole-repository two-pass exit audit plus final verification through [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3).

## Decisions and unknowns to settle before coding

1. The M0 event ledger v1 only records shots and full time. M1 additions must receive an explicit schema/engine version without silently changing old event meanings.
2. Competition rules require verification of injury/concussion substitutions, game windows and sanctions from the primary regulations and related documents before any exact-realism claims.
3. Tactical settings are validated inputs but their effects have not yet been designed, implemented or calibrated.
4. Match calibration reference sources need both statistical suitability and lawful reuse. A published final aggregate must include seed cohort, assumptions, versions, sample size and measurement method.
5. No browser or remote service can be an authority for match probabilities. Browser worker integration and the user-facing league season belong primarily to M2.

The first M1 implementation should introduce only the minimal tested state transitions needed to make a zero-event or 0-0 fixture deterministic; avoid a broad engine rewrite without incremental invariants.
