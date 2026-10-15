# Match engine (M0 design)

This document specifies a future headless football match simulation. No graphical match rendering is planned in early versions.

**M0 version binding:** `MATCH_LEDGER_VERSION=1`, `M0_ENGINE_VERSION="0"` (there is no event generator yet), `M0_RULES_PACK_ID="synthetic-rpl-scale"`, and `M0_RULES_PACK_VERSION="1"` are explicit required fields. An unknown combination is rejected rather than interpreted as the same historical match. The synthetic rules are *not* the official 2026/27 RPL rules pack. Versioned future M1 event protocols must not silently reinterpret the M0 `shot` or `full-time` events.

**Schema strictness:** the M0 `shot` and `full-time` events admit only their explicitly declared version-1 fields. Unknown or omitted event keys fail validation instead of being silently ignored or interpreted as a new event format. Additional information in future events requires an explicit versioned protocol revision.

**Implemented M0 subset:** `src/core/match-contracts.ts` validates a versioned, seeded pre-match snapshot and a bounded, ordered event ledger. It derives score, shots, on-target shots and fixed-point xG from `shot` events. The only terminal event is `full-time`. This is a contract/validator, **not a match generator**: own goals, penalties, substitutions, cards, injuries, abandoned matches and match-engine balancing remain deliberately unsupported until M1.

**Tactical input (M0):** `src/core/tactics.ts` supplies a versioned per-club plan. The formation's outfield line counts must sum to 10; mentality is an integer from -2 to 2, and pressing, compactness, defensive line, passing risk and tempo are integers from 0 to 100. Both teams' plans are required and checked with the fixture. These controls do not yet influence match outcomes; tactical response curves and formation/position fit are M1 design and calibration tasks. Do not present these prototype records as complete RPL match rules.

## M1 P1 partial implementation: deterministic clock/checkpoints

With explicit owner authorization on 2026-10-15, `src/core/m1-clock.ts` adds a **separate** `M1_ENGINE_VERSION='1'` and `M1_CLOCK_SCHEMA_VERSION=2`. It reuses the M0 full-time-only validator as a strict pre-match admission check; it does **not** modify the M0 `engineVersion='0'` or ledger v1 meaning. Once started, the machine holds only a minimal copy of validated fixture and rules IDs, PRNG seed and clock events, **not the caller's mutable data**.

A single `advanceM1Clock` call moves the virtual clock five minutes and appends one canonical checkpoint; step 18 appends the only `full-time` event. `runM1Clock` composes precisely those same transitions, guaranteeing identical replay for paused/resumed JSON-serialized progress and uninterrupted auto-runs. The current zero-goal result has **no random football actions**, deliberately consumes **zero** `xorshift32-v1` draws, and is NOT presented as a completed simulation or calibrated 0-0 probability. Every serialized continuation is revalidated against the canonical 18-event schedule, bounded time and ID/version fields before use. Bad state fails closed with typed errors.

This is a **P1 partial checkpoint**, not P1/P2 completion: no command scheduling, player activity engine, possession decisions, chances or tactical dynamics yet. Adding actual action events or new participant semantics requires explicit engine/event schema review and regression vectors. Future pauses, staff-authorized in-match commands and fast-forward will share this pure stepping boundary; command authorization is not implemented by this early clock alone. M1 remains OPEN.

## M1 P1 control protocol, first tactical commands

The separate `src/core/m1-control.ts` control wrapper keeps a serializable authority snapshot for each club (human player by default when explicitly assigned; otherwise a specific available staff ID) and a bounded, strictly ordered list of admitted `set-tactics` commands. Each command has its own **schema v1**, distinct from the M1 clock event schema v2 and historical M0 report ledger. A command must match the fixture and team, current virtual-time checkpoint and exactly the appointed actor, with an entirely validated tactical plan. There is no implicit assignment to staff and no authority for a different available staff member. Unknown, duplicate, out-of-order, overly numerous and post-full-time commands are typed failures; failure returns no updated match state.

For replay the control validator recomputes the latest plans from the original saved tactics and *all admitted commands*. This prevents accidentally accepting a state whose logged history disagrees with its current tactics. This is **not cryptographic authentication**: the authority snapshot must be supplied by a trusted career repository, and a fully forged but self-consistent stored object needs authenticated external provenance in M2. It is also not an official RPL substitutions policy.

`advanceM1ControlledMatch` applies only previously admitted plans to future steps; `finishM1ControlledMatch` uses precisely the same step loop. A submitted plan does not rewrite earlier clock events or alter the M0 ledger. This P1 contract has **no physical football actions or tactical effect on shot probabilities yet**: it records inputs and deterministic order for P2; all draws remain zero until the action generator is separately versioned. The current 0-0 report has no realism meaning. Follow test cases in `tests/m1-control.test.mjs`.

## Contract

Input: frozen pre-match player/team snapshots, validated lineups and tactics, versioned competition rules, engine version, explicit PRNG algorithm/version and seed.

Output: ordered match events, final score, team/player statistics, player condition and discipline changes, and diagnostic data.

The same engine calculates user matches and all AI games. It must not depend on React, IndexedDB, web servers, browser time, locale, unordered iteration or Math.random(). Match state is computed before any atomic career-state commit.

## Flow

1. Validate the squad, legal 11, bench, injuries, bans, roles and competition rules.
2. Initialize match clock, possession, pitch zone, stamina, score, cards and substitutions.
3. Repeatedly resolve meaningful possessions, transitions, chance creation, set pieces and stoppages.
4. Select participants using role, tactics, space, attributes, fatigue and opposition.
5. Resolve each action with bounded probabilities and versioned randomness, advancing virtual time.
6. Append resolved events, apply in-match state changes, and handle substitutions and disciplinary events.
7. Finalize event ledger and calculate post-match deltas. Apply result only once to the career via command orchestrator.

Use discrete pitch zones and possession phases rather than simulating each player's physical movement.

## Source-of-truth and invariants

- Score and stats derive from an ordered event ledger, never independently generated.
- Regular goals result from a valid scoring shot; own goals use a distinct event; penalties use validated set-piece events.
- Shots on target cannot exceed total shots. A save needs an on-target attempt.
- Each shot's xG is assigned before its outcome; summed shots determine xG totals.
- Player events belong to eligible active participants; substitutions enforce current rules; cards/injuries affect subsequent play.
- Match clock is monotone. Stoppage time and special statuses are explicit.
- Every fixture is finalized once, with table, condition and discipline updated atomically.
- Invalid fixtures or exceeded computational bounds produce typed failures, never plausible invented results.

## Tactical influences

Formation, role fit, pressing, compactness, defensive line, passing risk, possession tempo, team familiarity, home effect and fatigue affect the underlying action probabilities. A tactical counter changes probabilities rather than guaranteeing an outcome. RNG produces football uncertainty; it must not override league-rule validity.

## Reproducibility

**Implemented M0 RNG compatibility contract (proposed for M1):**
`src/core/rng.ts` uses `xorshift32-v1` with a nonzero unsigned 32-bit
integer seed from `1..4294967295`. Each draw applies XOR/shift by
`(13 left, 17 unsigned-right, 5 left)` in that exact order and stores
the unsigned 32-bit result. `nextFloat()` returns `nextUint32() /
4294967296`, consuming exactly **one** generator step, with an
inclusive lower bound and exclusive upper bound `[0,1)`. Snapshot/
restore transfers the exact integer continuation state. The algorithm
is **not cryptographically secure** and must not be used for secrets.

`tests/rng-vectors.test.mjs` pins exact multi-seed integer outputs,
resume boundaries and float normalization. The saved `RNG_VERSION`
protects compatibility for revision-0 career snapshots and early
contracts. A future change of algorithm or draw consumption order
requires a new version and reviewed replay/migration tests.
**This does not by itself approve the M1 random-number architecture
or prove a statistically realistic football model.**

Version and store the PRNG algorithm, seed and continuation state. Same frozen inputs and same engine/rules versions must give identical event order and results. Randomness must be consumed in a stable explicit sequence. Never claim reproducibility across changed engine versions unless a compatibility/replay layer verifies it.

## M1 P2 preliminary synthetic events, not calibrated real football

`src/core/m1-phases.ts` implements an **experimental and explicitly new** action generator: engine version `2`, action event schema `3`. It uses the validated synthetic pre-match snapshot, fixed 18-phase clock and accepted P1 staff-authorized tactical-command schedule. Each five-minute phase consumes five seeded RNG draws in fixed order (**home/away possession, chance, shooter, xG quality, outcome**) whether or not there is a chance. Separate action RNG continuation and exact draw count are recorded; clock-only PRNG state remains unchanged, preserving its legacy contract. Probability inputs include each side's synthetic attributes, position/role, home advantage, tactical sliders and opposing goalkeeper. Probabilities are bounded but **not calibrated** and do not reproduce real RPL disciplinary/statistical laws.

Each regular shot is recorded once in a versioned v3 action ledger **before final reporting**, with xG drawn from its dedicated random input prior to the outcome draw; a strict independent read-only derivation validates chronology, active outfield shooter, identity, xG, event count and schema and produces the full-time goals/shots/on-target/xG totals. No standalone final score is generated. This does not alter or migrate the historical M0 v1 `deriveMatchLedger` event meaning. Run reproducibility and sensitivity tests with fixed paired seeds rather than fitting arbitrary match results. A single action stream is currently generated end-to-end, not yet an interactive mid-match phase-snapshot API. The previous M1 clock/commands are still separately resumable and deterministic, but the action probability generator requires its own versioned continuation contract in later PRs.

Full official RPL substitution/card/injury/penalty/own-goal events, authentic roster rules, abandonment exceptions and legal real-player data require later primary-source/rights reviews and explicit new schemas. No performance or 10,000-seed realism acceptance is claimed by this P2 increment.

## M1 P2 checkpoint regeneration instead of unverified state continuation

`createM1PhaseCheckpoint` and `resumeM1PhaseCheckpoint` in `src/core/m1-phase-checkpoint.ts` produce/consume a **synthetic action checkpoint** with completed-phase count, v3 ledger prefix, P1 tactical command history and clock state, number of PRNG draws and resulting continuation integer. Every checkpoint is **independently rederived from authenticated canonical prematch/policy inputs and original seed**, in a bounded 18-phase replay. Resume first compares complete own-key shape/value history to the regenerated checkpoint, then refuses backdated orders before the saved second. Later commands affect only later phases, without changing old events or draw counts. No browser, network, wall time or uncontrolled random source is used.

**Updated P2 implementation:** on each resume the prior phases are replayed from seed **only to verify the persisted checkpoint**, then exactly the missing phases advance from its independently verified PRNG continuation state using the same canonical per-phase evaluator as uninterrupted auto-run. Future phases are not pre-simulated. This is now a true seeded calculation continuation after verification, but still performs a bounded prefix replay for trust and does not claim a benchmarked speedup. A future verified true RNG resume may use its stored continuation state only with separate equivalent replay/bit-identity tests and explicit protocol review. No cryptographic provenance is implied by structural comparison; the source snapshot, actor assignments and saved record must be trusted by the future M2 persistence/authority boundary. The results remain synthetic, uncalibrated and do not include legal substitutions or other real competition rules.

The internal `extendTrustedM1PhaseWindow` accepts only already validated in-memory or replay-verified state; calling it directly with untrusted JSON is outside its contract. The external `resumeM1PhaseCheckpoint` enforces that boundary. Action engine version `2`, event schema `3` and all five-draw RNG vectors are preserved. Independent-seed replay tests compare whole match events, scores, xG and final xorshift32 state.

## M1 P1 independent individual-instruction admission contract

The new `m1-player-control` module retains existing `M1_CONTROL_SCHEMA_VERSION=1` team tactics and adds its own versioned `set-player-focus` commands (individual command version `1`). Accepts `balanced`, `attack`, `defend` for **registered active outfield starters**, not substitutes or goalkeepers, at 300-second virtual checkpoints only. The explicitly appointed tactical actor must match team delegation. Mixed team and individual commands have independent streams but cannot reuse command IDs; current per-player instructions are canonical, ordered by stable IDs, and full history is replay-verified from the **trusted prematch plus policy** at every application/advance. The module is headless, deterministic and always rejects unverified or tampered continuation.

The commands record an intention for future P2 but **do not affect existing action engine version `2` / event schema `3`**. An explicit separately versioned action generator is required to apply these player-specific decisions to game outcomes and document realistic bounds. Do not infer individual tactical effects or authentic personnel rights from an accepted command alone.

## M1 P2 isolated action engine v4

The experimental `m1-phases-v4` engine introduces independent engine `3` and ledger schema `4`, leaving prior M0 shot/full-time v1, P1 clock v2, M1 action v3 and their seeded replay semantics untouched. The v4 shot carries a validated outfield participant, left/center/right synthetic attacking zone, effective `balanced/attack/defend` player focus, deterministic `fatigueMilli` (700..1000), xG in thousandths assigned **before** shot outcome, and one of the four shot outcomes. Version-4 arithmetic is derived only from a monotonic version-4 ledger, with shared historical v3 goal/shot/xG counting after strict v4 structural checks. It does not claim that the v3 reader accepts v4 or that structural event validation proves a specific original RNG trace.

At every 300-second virtual boundary the engine admits valid player and team orders through the same trusted-source policy, then draws exactly five seeded random values for possession, chance, shooter, pre-outcome quality/zone and outcome. Position/finishing weights, assigned player focus, tempo/mentality/passingRisk, pressing/stamina/elapsed fatigue and modest zone adjustments affect selected synthetic shots. Both event sequence and final PRNG state are repeatable. These coefficients have **no rights-reviewed real-world football calibration**. No v4 pause/resume action checkpoint yet: P1 individual-command replay is supported separately, but version-3 shot checkpoints cannot be mixed with v4 history. Actual persistent fatigue, substitutions, disciplinary/injury/rules events and source-verified 2026/27 sporting rules require subsequent M1/M2 work.

## M1 testing and calibration

Use synthetic clubs. Test 0-0, mismatches, late winning goals, red cards, injuries, penalties, own goals, no bench, substituted scorer, invalid roster, overtime, and multi-fixture batches. Validate ledger and score consistency, deterministic save/load, bounded numbers, match completion and single-apply semantics.

Calibrate using the [M1 calibration protocol](M1_CALIBRATION_PROTOCOL.md), with 10,000 seeded matches per scenario and documented source-permitted reference distributions: goals, draws, home/away results, shots, xG, cards, injuries and player attribute/tactics sensitivity. Preserve baselines and confidence intervals. Do not invent target realism metrics or claim successful calibration before running actual tests.

Open design choices: whether to adopt the existing, vector-tested M0 PRNG unchanged for M1; probability curves, spatial zones, saved event detail, competition-specific disciplinary and abandonment policies. The current algorithm and replay semantics are specified and tested, but owner approval for M1 usage is pending.

## Later owner-approved interactive match requirement

[ADR-0007](adr/0007-match-tactics-multicurrency.md) approves **both unattended match completion and player-controlled in-match tactical interventions**. The future match engine must expose deterministic virtual-time pause/checkpoints; accept authorized commands to make legal substitutions, change formation, update team tactics and issue individual player instructions; persist their order/virtual timestamp and exact PRNG continuation; and validate sport-rule constraints before application. This will require explicitly versioned event/command schemas in M1/M2. The present M0 `MATCH_LEDGER_VERSION=1` only reports shots and full time, and is **not** permission to implement the M1 engine before the M0 exit and separate owner authorization.
