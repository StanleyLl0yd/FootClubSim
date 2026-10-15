# M1 execution backlog (prepared during M0)

**Status: M1 explicitly authorized by the project owner on 2026-10-15.** [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) was closed after complete acceptance. M1 implementation may now proceed incrementally through the listed issues; **M1 exit #3 stays OPEN** pending complete engine, meaningful empirical calibration, owner acceptance, two whole-repository exit audits and final CI. Relative effort estimates are not delivery dates.

| Order | Issue | Depends on | Relative effort | Main risk |
| --- | --- | --- | --- | --- |
| 1 | [#27: seeded state machine and replay](https://github.com/StanleyLl0yd/FootClubSim/issues/27) | M0 engine/tactics contracts, #2 | L | Inconsistent PRNG consumption or unversioned events |
| 2 | [#28: chance creation and outcomes](https://github.com/StanleyLl0yd/FootClubSim/issues/28) | #27 | L | Unrealistic or unstable scoring probabilities |
| 3 | [#29: substitutions and discipline](https://github.com/StanleyLl0yd/FootClubSim/issues/29) | #27, #28, verified rules | L | RPL exceptions and changing on-field legality |
| 4 | [#30: match report and single-apply commit](https://github.com/StanleyLl0yd/FootClubSim/issues/30) | #27, #29 | M-L | Duplicate fixture effects on retry or partial state |
| 5 | [#31: calibration, property tests, performance](https://github.com/StanleyLl0yd/FootClubSim/issues/31) | #27-#30 | L | Overfitting to assumptions or using unlicensed baselines |
| Exit | [#3: two-pass full-repository audit](https://github.com/StanleyLl0yd/FootClubSim/issues/3) | all M1 criteria | L | CI/browser and rights evidence gaps |

Relative effort here is qualitative (L > M), not a duration guarantee. Dependencies determine execution order; limited overlap is possible after core event and rule interfaces have stabilized.

## M1 P1 first implementation checkpoint (2026-10-15)

The initial `src/core/m1-clock.ts` and `tests/m1-clock.test.mjs` implement a **pure and bounded 90-minute virtual match clock**, with 18 five-minute transitions, an explicitly separate `engineVersion='1'` and **clock event schema v2**, validated M0 synthetic pre-match inputs, serialized checkpoint pause/resume, automatic/single-step equivalence and strict rejection of altered continuation history. The preliminary 0-0 terminal report is **not a football outcome generator**: there are no shots, possessions, tactical effects, substitutions or disciplinary incidents. All checkpoints consume **zero** PRNG draws; the seed/continuation state is pinned for future explicitly versioned action scheduling. This increment is a **partial** implementation of [#27](https://github.com/StanleyLl0yd/FootClubSim/issues/27), not a P1/P2 completion or a realistic match. The existing M0 v1 shot/full-time validator and revision-0 saves remain unmodified.

Next work under #27: versioned, admitted in-match command queue and deterministic command ordering/authority; meaningful on-field state and PRNG consumption once P2 possessions/actions begin; preserve historical event protocol IDs rather than silently overloading the clock events. Authentic RPL exceptions remain M2 source-verified gates. **Do not interpret a green clock test as M1 milestone acceptance.**

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

## Owner-approved in-match interaction contract (2026-10-14)

[ADR-0007](adr/0007-match-tactics-multicurrency.md) requires a single deterministic seeded engine for fully automatic and interactive fixtures, with versioned pause/checkpoint and legally validated mid-match substitutions, formation/tactical and individual-player instructions. Scope this as future M1 **engine interfaces and deterministic negative tests**; the actual M2 UI and 2026/27 RPL executable rules remain later-stage gates. Owner approval of architecture does **not** authorize coding M1 before M0 is fully closed and explicit approval to start M1 is received.
