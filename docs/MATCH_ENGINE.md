# Match engine (M0 design)

This document specifies a future headless football match simulation. No graphical match rendering is planned in early versions.

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

Version and store the PRNG algorithm, seed and continuation state. Same frozen inputs and same engine/rules versions must give identical event order and results. Randomness must be consumed in a stable explicit sequence. Never claim reproducibility across changed engine versions unless a compatibility/replay layer verifies it.

## M1 testing and calibration

Use synthetic clubs. Test 0-0, mismatches, late winning goals, red cards, injuries, penalties, own goals, no bench, substituted scorer, invalid roster, overtime, and multi-fixture batches. Validate ledger and score consistency, deterministic save/load, bounded numbers, match completion and single-apply semantics.

Calibrate with thousands of seeded matches and documented source-permitted reference distributions: goals, draws, home/away results, shots, xG, cards, injuries and player attribute/tactics sensitivity. Preserve baselines and confidence intervals. Do not invent target realism metrics or claim successful calibration before running actual tests.

Open design choices: exact PRNG, probability curves, spatial zones, saved event detail, competition-specific disciplinary and abandonment policies.
