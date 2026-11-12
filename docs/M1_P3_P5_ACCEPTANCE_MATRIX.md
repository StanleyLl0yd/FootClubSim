# M1 P3/P5 — nine-block functional closure matrix

**Status: 3/9 ACCEPTED; P3 2/4, P5 1/5. M1 and exit #3 OPEN, M2 prohibited.**
This is a *tracking subdivision* of existing [P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29) and [P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31), not a rewrite or relaxation of either issue's acceptance criteria. P1 #27, P2 #28, deferred P4 #30 and the two full repository-wide audits in exit #3 are **additional independent M1 obligations**, not silently included in the nine.

The executable source of the nine records is `data/m1-p3-p5-closure-gates.json`. Every record begins **open**, despite extensive partial implementations and previously successful CI. Only move a gate to `accepted` after its entire `criteria` list is demonstrated on the integrated playable engine, with exact-main SHA, evidence URLs and written acceptance; no increment of the counter from a research-only or regression-only PR.

| Block | Acceptance area | Dependency | Current status |
| --- | --- | --- | --- |
| P3-1 | Unified match authority and physical XI | Independent | ACCEPTED — [exact-main review](https://github.com/StanleyLl0yd/FootClubSim/issues/29#issuecomment-6603275980) |
| P3-2 | Medical events and exceptions | P3-1 | OPEN |
| P3-3 | Discipline and match-specific suspensions | P3-1 | ACCEPTED — [exact-main review](https://github.com/StanleyLl0yd/FootClubSim/issues/29#issuecomment-6826198408) |
| P3-4 | Complete two-team career chronology | P3-1, P3-2, P3-3 | OPEN |
| P5-1 | Lawful comparable metric taxonomy | Independent | ACCEPTED — [exact-main review](https://github.com/StanleyLl0yd/FootClubSim/issues/31#issuecomment-6799941107) |
| P5-2 | Final playable-engine statistical calibration | P3-1, P3-2, P3-3, P3-4, P5-1 | OPEN |
| P5-3 | Independent held-out validation | P5-2 | OPEN |
| P5-4 | Integrated property, fuzz and recovery gates | P3-4 | OPEN |
| P5-5 | Accepted real-platform performance budget | P3-4 | OPEN |

## Fastest safe execution order

1. **Completed:** earlier gated #430/#431 work and P3-1 source integration #468 are on protected main. Do not reopen closed integration work without a demonstrated regression.
2. **P3-1 and P3-3 ACCEPTED.** Complete P3-2 on the same v188 source, then close P3-4 recovery and rescheduling. Unauthenticated external KDK input stays refused. Preserve M0/v8 and persisted schema compatibility.
3. Do not mark P3-4 accepted merely because 240-fixture Chromium replay passed: rescheduling and clinical/KDK-dependent restrictions still need positive and negative evidence.
4. **P5-1 ACCEPTED** with only all-type goals comparable. In parallel, establish P5-4 final-engine adversarial harness and verify the predeclared P5-5 budgets. These tasks do not require opening the sealed 2024/25 holdout.
5. After final P3 engine is frozen, carry out **P5-2** full-engine calibrated aggregate/cohort work. Only then, with frozen thresholds and rights, perform **P5-3** once. Finish P5-4/5 on the identical final engine and browser targets.
6. Even after all nine gates are accepted, keep M1 exit #3 open until P1/P2/P4 acceptance and **two genuinely complete repository-wide audit passes**, review, security, source/rights check and exact-main CI are recorded.

## Review and anti-drift contract

- Each functional PR must name one or more block IDs, cite which exact **criterion** it changes and include positive/negative cases. If no complete criterion changes, label it a supporting regression, not closure.
- Keep source/referee event authority, fantasy medical recovery and real clinical/KDK evidence separate. An internally derived deterministic referee may authorize fictional gameplay; it cannot prove real external sports rulings.
- Keep the synthetic outcome and published definitions separate: **open-play-only != all-goal**; generic blocked shots != provider-specific shots on target. No fabricated benchmark pass, invented source rights, external referee signature or approval.
- Maintain original journals/seed determinism, protected squash-only `main`, strict exact-head CI and exact-main rechecks. Never open the 2024/25 holdout before freezing model, rights, categories and acceptance tolerances.
- Record a gate's `verification` only after checking its content: `exactMainSha` (40-character SHA), `evidenceUrls` (real GitHub links) and `acceptedBy` (written acceptance source). A successful PR alone is insufficient.

## Next work (not closure claims)

- **P3-1 ACCEPTED:** [#468](https://github.com/StanleyLl0yd/FootClubSim/pull/468) unified the dense physical source and replayed stopped clock; explicit [3/3 review](https://github.com/StanleyLl0yd/FootClubSim/issues/29#issuecomment-6603275980) on `1b801aeedb5c3f34dbe3b4c9b624f9335f724fb7`, 9/9 required exact-main PASS. Preserve this contract while implementing P3-2/3/4.
- **P3-2:** Complete source-driven medical/return transitions and executable exception coverage.
- **P3-3 ACCEPTED:** [all-three-criteria exact-main signoff](https://github.com/StanleyLl0yd/FootClubSim/issues/29#issuecomment-6826198408) on `21bfe37906a905f94900c9475e1694fc6a7fc767`, 9/9 PASS. Replay-derived fictional holds and expiry affect both teams; unsupported official KDK/appeal claims are typed-refused, never inferred authenticated. This does not complete P3-4 fixture rescheduling or real external KDK integration.
- **P3-4:** Replace selected-club-only unknown opponent history with replay-verified two-team coverage and season gates.
- **P5-1 ACCEPTED:** [exact-main all-three-criteria review](https://github.com/StanleyLl0yd/FootClubSim/issues/31#issuecomment-6799941107) on `80171eb86b5caeebf320a3a50e83c05ffbd0245c`, 9/9 PASS. The comparison covers 2025/26 published *all-type goals only*; every incompatible shot/xG/card/penalty/medical/outcome metric is explicitly excluded without claiming external license. Preserve this exact category freeze through later P5-2, not a blanket statistical calibration approval.
- **P5-2:** Freeze integrated engine, measure its actual output and tune only legitimate development references.
- **P5-3:** Execute one-time holdout protocol only after all prerequisites are evidence-verified.
- **P5-4:** Consolidate existing campaigns around the selected playable path; add missing cross-module and fault-injection cases.
- **P5-5:** Define measurable limits, profile full integrated season and optimize only proven bottlenecks.

Re-evaluate each gate when a genuinely integrated functional PR lands. Do not default to “nine remain” by habit, but do not decrement without complete and independently verified acceptance.
