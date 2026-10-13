# M0 acceptance checklist

Status: **OPEN**. Evidence must come from actual implementation, source review or observed tests, not from the existence of this checklist. Complete and cross-reference [M0 exit issue #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) before declaring M0 closed.

## Scope and documentation

- [x] Create public FootClubSim repository and adapt `AGENTS.md` from WindowTidy.
- [x] Create dedicated whole-repo exit issues for M0–M6.
- [ ] Review and approve roadmap, boundaries and platform plan.
- [ ] Agree on how the user role splits manager/trainer/sporting director responsibilities.
- [ ] Sign off player attributes, tactics, economy representation and minimum season rules.
- [ ] Record decisions in ADRs and resolve identified incompatibilities in the specifications.
- [ ] Verify official RPL 2026/27 rules from primary document and cite exact revision for each encoded rule.

## Data readiness

- [ ] Define and implement versioned catalog, career-save and source-provenance schemas.
- [ ] Add a **synthetic** fully rights-safe test league/player dataset and validation.
- [ ] Demonstrate duplicate identity detection, malformed data rejection and cross-reference checks.
- [ ] Decide what real RPL data/club imagery can legally be distributed, with recorded permission.
- [ ] Ensure no prohibited scraping, copyrighted assets, production/private credentials or secret values are committed.

## Code and tooling foundation

- [ ] Create the minimal TypeScript strict workspace with Vite/React browser shell and isolated headless domain packages/modules.
- [ ] Commit dependency lockfile, define numeric-only versioning and safe production build.
- [ ] Set formatting, lint, types, unit tests and CI, with least privilege and pinned external actions.
- [ ] Implement/document worker orchestration contract and command/state validation in focused tests.
- [ ] Test export/import prototype or document a reproducible proof-of-concept with bounded error handling.
- [ ] Verify on macOS Safari and Windows Chromium or explicitly record untested configurations.

## Match engine preparation

- [ ] Agree deterministic PRNG contract and exact input/event/output schema.
- [ ] Establish a synthetic fixture matrix and tests for invariants before balancing.
- [ ] Define measurable calibration distributions, sampling method, uncertainty/tolerances and permitted reference sources.
- [ ] Specify rule-pack handling of registration, standings and disciplinary differences.
- [x] Open the [prioritized M1 implementation backlog](M1_BACKLOG.md); remaining effort estimates and technical risks still require approval.

## Repository-wide milestone exit

- [ ] Inspect **entire repo**, including docs, scripts, source, tests, dependencies, build, workflows and settings.
- [ ] Do a first complete audit and implement safe corrections/refactoring.
- [ ] Do a mandatory second full pass over the already-refactored repo.
- [ ] Run full applicable tests, build, format, types, security, source-rights and browser verification, with evidence; never claim checks that were not run.
- [ ] Publish M0 audit report: findings, changes, unchanged risks, limitations, before/after metrics with consistent method.
- [ ] Attach audit report, PRs and final-main CI results to issue #2 and close only after criteria actually pass.

## Important caveat

Initial M0 design documentation is **not** an implemented match engine. Do not claim that TypeScript, game rules, a real RPL roster, browser saves, tests, CI or game release are working just because they are described here.
