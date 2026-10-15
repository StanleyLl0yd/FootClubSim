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

## M1 P1 second increment: versioned tactical command control (2026-10-15)

`src/core/m1-control.ts` implements a **separate M1-only command protocol** for the P1 checkpoint scaffold. `M1_CONTROL_SCHEMA_VERSION=1` and `M1_TACTICS_COMMAND_VERSION=1` are distinct from historical M0 match ledger v1 and M1 clock schema v2. The control state includes original per-team tactical plans, a current plan, explicit owner/delegated-staff tactical authority, a bounded **64-command** history and the already-tested serialized M1 clock. Every accepted command is stamped with its unique stable ID, fixture/team, current virtual second and ascending sequence; command replay reconstructs final tactics and rejects stale times, forged actors, duplicates, history gaps, invalid tactics and history/current-state discrepancies. Normal and fast-forward clocks use identical `advanceM1Clock` transitions and retain the ordered command history. This increment does **not** implement tactical effectiveness, shots, substitutions, card policy or gameplay UI.

The `authority` snapshot **must originate in a trusted career/admission context**. A modified serialized state with internally consistent but forged authority cannot be cryptographically distinguished by this purely local schema check; external storage integrity/authorization will be required when connecting M2 player/staff context. Staff IDs and assignments are hypothetical P1 inputs, **not** an official personnel pack. The control layer is designed as a closed-system consistency validator, not a security capability token or an online matchmaking anti-cheat boundary.

The engine is still **P1 INCOMPLETE** because actual meaningful football actions, deterministic probability draw scheduling, individual instructions and substitutions remain future work in #27/#28/#29. In this clock-only stage all 18 transitions consume **zero random draws** and a completed 0-0 is an intentionally empty simulation result, not evidence of match realism. Do not auto-close #27.

## M1 P2 first executable shot phases (2026-10-15, experimental)

`src/core/m1-phases.ts` adds a bounded **synthetic-only** match-action model to the accepted 18x300-second P1 virtual clock. It uses **a new action-engine version `2` and event schema `3`**, separate from M0 `shot/full-time` ledger v1, M1 clock schema v2 and M1 tactical command protocol v1. Each phase consumes exactly **five `xorshift32-v1` draws** regardless of whether a shot occurs: possession, chance, shooter, pre-outcome shot quality/xG and outcome. The final PRNG continuation state is reported independently of the earlier clock-only state. One or zero shots may occur per phase; no action is sampled after 90 minutes.

Synthetic chance weights use team passing/decision/marking aggregates, home advantage and bounded mentality/tempo/passing risk; shooter selection is weighted by role, off-ball movement and finishing; xG uses finishing, composure, shot-quality draw and opposing goalkeeper reflexes, **computed before** the goal/save/blocked/missed resolution draw. Every recorded v3 shot has bounded fixed-point xG, eligible active non-GK shooter, stable deterministic phase time and canonical ID. A separate strict `deriveM1SyntheticLedger` produces the score, shots, shots on target and xG **only from the event sequence**, rejecting invalid foreign-schema/type/participant/time/event fields. No final score is sampled directly. Tactics commands from the separate P1 module may be applied before their phase checkpoint, never retroactively, with fixed PRNG draw consumption. Actual production play, injuries, cards, penalties, substitutes, condition changes, league rules, suspended matches, genuine statistical calibration and the M1 exit audit are **not** implemented. Aggregated internal paired-seed directional tests demonstrate sensitivity, **not** independently validated football realism.

**A one-shot reference generator is not yet a fully interactive stateful P2 action-resume protocol**: the output's action ledger and final RNG state are preserved, but intermediate phase snapshots cannot independently resume generation yet. That remains future M1 work alongside verified probability tuning. No changes are made to the M0 synthetic catalog format, identities, save data or shipped browser UI.

## M1 P2 replay-verified intermediate action checkpoints (2026-10-15)

`src/core/m1-phase-checkpoint.ts` adds a bounded, **replay-verified** action snapshot API for every exact 300-second boundary (0 through 18 phases). It regenerates the entire prior synthetic stream from the **trusted original prematch snapshot, policy, accepted historical tactical commands and seed**, then returns only the events, RNG state and clock history at the requested boundary. Upon resume, it independently reconstructs the previous checkpoint and checks its exact own-key/value structure before allowing new commands **only at or after the saved virtual second**. Recomputing from seed is deliberately bounded (18 phases) and maintains identical event prefixes even when new tactics are supplied for the later portion.

The previous implementation reconstructed **all 18 phases** for every snapshot. The next P2 increment now shares one phase evaluator between direct auto-run and checkpoint continuation. On resume the **historical prefix remains independently replay-verified from the trusted seed**, but only *missing* future phases are executed from the stored RNG continuation; exactly five new draws per new phase. This reduces wasted future simulation and avoids recomputing earlier actions in the resumed execution path, while retaining the deliberate bounded prefix check. Input authenticity, cryptographic integrity of career records, user identity and entrusted staff delegation must be enforced by the future M2 career repository; a tampered but fully self-consistent set of *both* trusted inputs and checkpoint cannot be detected by a pure function. The action model still has no substitutions/injuries/cards or 10k-seed lawful-reference calibration, and does not establish P2 exit success. Future work can optimize true PRNG continuation under a new schema without changing the currently versioned replay contract.

## M1 P2 direct seeded phase continuation (2026-10-15)

`src/core/m1-phases.ts` now centralizes the canonical single-phase action decision and provides an **internal trusted-window** continuation operation. It never accepts a serialized snapshot as authoritative on its own. The public `resumeM1PhaseCheckpoint` first replays prior seed/commands using the validated trusted prematch/authority input and checks its complete own-key history; **only then** does it resume from the verified `xorshift32-v1` state to calculate the missing phases. The initial checkpoint at phase zero consumes no draws, each additional phase exactly five; identical commanded runs yield identical shot events, report and final RNG state to full auto-run. The original M0 save format, M1 action-v3 and clock-v2 schemas remain unchanged. The prefix integrity replay still costs work proportional to already played time; this is not an authenticated storage mechanism or demonstrated performance benchmark.

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
