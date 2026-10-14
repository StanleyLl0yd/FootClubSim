# Match engine (M0 design)

This document specifies a future headless football match simulation. No graphical match rendering is planned in early versions.

**M0 version binding:** `MATCH_LEDGER_VERSION=1`, `M0_ENGINE_VERSION="0"` (there is no event generator yet), `M0_RULES_PACK_ID="synthetic-rpl-scale"`, and `M0_RULES_PACK_VERSION="1"` are explicit required fields. An unknown combination is rejected rather than interpreted as the same historical match. The synthetic rules are *not* the official 2026/27 RPL rules pack. Versioned future M1 event protocols must not silently reinterpret the M0 `shot` or `full-time` events.

**Schema strictness:** the M0 `shot` and `full-time` events admit only their explicitly declared version-1 fields. Unknown or omitted event keys fail validation instead of being silently ignored or interpreted as a new event format. Additional information in future events requires an explicit versioned protocol revision.

**Implemented M0 subset:** `src/core/match-contracts.ts` validates a versioned, seeded pre-match snapshot and a bounded, ordered event ledger. It derives score, shots, on-target shots and fixed-point xG from `shot` events. The only terminal event is `full-time`. This is a contract/validator, **not a match generator**: own goals, penalties, substitutions, cards, injuries, abandoned matches and match-engine balancing remain deliberately unsupported until M1.

**Tactical input (M0):** `src/core/tactics.ts` supplies a versioned per-club plan. The formation's outfield line counts must sum to 10; mentality is an integer from -2 to 2, and pressing, compactness, defensive line, passing risk and tempo are integers from 0 to 100. Both teams' plans are required and checked with the fixture. These controls do not yet influence match outcomes; tactical response curves and formation/position fit are M1 design and calibration tasks. Do not present these prototype records as complete RPL match rules.

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

## M1 testing and calibration

Use synthetic clubs. Test 0-0, mismatches, late winning goals, red cards, injuries, penalties, own goals, no bench, substituted scorer, invalid roster, overtime, and multi-fixture batches. Validate ledger and score consistency, deterministic save/load, bounded numbers, match completion and single-apply semantics.

Calibrate using the [M1 calibration protocol](M1_CALIBRATION_PROTOCOL.md), with 10,000 seeded matches per scenario and documented source-permitted reference distributions: goals, draws, home/away results, shots, xG, cards, injuries and player attribute/tactics sensitivity. Preserve baselines and confidence intervals. Do not invent target realism metrics or claim successful calibration before running actual tests.

Open design choices: whether to adopt the existing, vector-tested M0 PRNG unchanged for M1; probability curves, spatial zones, saved event detail, competition-specific disciplinary and abandonment policies. The current algorithm and replay semantics are specified and tested, but owner approval for M1 usage is pending.
