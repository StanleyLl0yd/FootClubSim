# ADR-0013: M1 game-first acceptance rebaseline

Date: 2026-11-25
Status: **OWNER APPROVED** in the FootClubSim project conversation; effective on protected-main integration.

## Context

The owner explicitly approved all five proposed M1 scope decisions on 2026-11-25, including autonomous technical acceptance on objective evidence. The accepted Playable Preview remains separate from M1. This ADR supersedes conflicting M1 acceptance requirements only, not historical evidence, M2 sporting-rule obligations, or stable-release gate #155.

## Decision

1. **P3-2:** freeze medical v5 as the new-career default. Verify ordinary injury withdrawal, eligible substitutions, active XI, running-time treatment/return where supported, both-team availability and replay/CAS. Unsupported rare goalkeeper, concussion, severe-injury, collision or penalty-taker exceptions may fail closed; no extra clinical or referee-authentication model is required for M1. Preserve existing versions/tests and distinguish fictional incidents from external clearance. Deferred exceptions are optional backlog, not silently implemented or officially certified.
2. **P3-4:** require coherent authoritative results for all 240 fixtures, both teams, ordinary injuries/holds, discipline, source-supported rescheduling and atomic current-format save/reload/retry. No implementation of external KDK appeals or clinical commissions is required for M1; unsupported claims remain typed-refused. No invented history or rewritten completed result.
3. **P5-2/P5-3:** at least 10,000 independently seeded balanced games on the final default playable engine, with career-cluster uncertainty, all generated metric categories, directional tactics/player sensitivity and lawful comparable aggregate realism. Retain the already frozen all-type-goal development tolerance (20% relative). Excluded or unavailable categories must be reported as such, not as passes or blockers in themselves. Freeze model, seed plans, rights and numerical thresholds before independent evaluation. Do not match individual historical scores or winners. The 2024/25 comparison was not strictly blind: a historical [#31 research comment](https://github.com/StanleyLl0yd/FootClubSim/issues/31#issuecomment-6518241034) disclosed aggregate observations. Keep the formal evaluation sealed until the freeze; disclose prior exposure, use independent evaluation seeds and an additional genuinely uninspected lawful reference if necessary to establish independent external validation. Never tune on the evaluation outcomes or claim blindness.
4. **P5-4/P5-5:** retain deterministic, adversarial, recovery, ordinary native browser CAS/reload and measured real-platform full-season performance gates. Define runtime, memory and journal-size limits before acceptance runs, with documented target hardware/runtime. Extreme real quota/eviction and release-grade storage lifecycle tests remain mandatory in #155 but do not block M1. Basic current-format save integrity and ordinary interruption/retry remain mandatory now.
5. **Acceptance authority:** the owner delegates technical P1–P5 signoff to the engineering agent based on explicit criterion-by-criterion evidence, exact-main SHA and real CI links. No separate owner confirmation is needed for each technical gate. Existing accepted blocks remain unchanged; scope approval is not evidence of a pass. Unsupported or missing evidence keeps its corresponding applicable gate open.

## Unchanged boundaries

- Two complete repository-wide audit/refactoring/code-review passes, security review, source/rights review and final verification under AGENTS.md and #3 are mandatory. No reduced-scope audit.
- Protected-main guarded squash, fresh applicable exact-head checks, verified parent/tree/signature and exact-main CI remain mandatory.
- M1 remains OPEN (3/9 P3/P5 accepted at decision time). P1–P5 and exit #3 require actual evidence. M2 formal acceptance and stable release remain prohibited until their separate gates.
- Medical v5 stays frozen absent a demonstrated game-breaking defect; no new onboarding medical experiments. M3 finance architecture under ADR-0009 remains unchanged.
- This decision does not grant external data rights, legal sporting-rule certification, production persistence claims, or manual product acceptance.

## Rollout

Synchronize ROADMAP, the executable closure matrix and its tests, calibration protocol, and GitHub issues #3/#27–#31/#155. Integrate through a reviewed PR. Then verify P3-2 and P3-4 on the supported default, freeze the engine, run calibration and independent evaluation, finish P5-4/P5-5 and formal P1–P5 review, and execute both full audits before closure.
