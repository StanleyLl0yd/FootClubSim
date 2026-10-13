# ADR-0002: Per-responsibility management and staff delegation

**Status:** Accepted in principle (owner decision 2026-10-14); exact UI details and coverage per milestone remain subject to acceptance testing.

## Context

FootClubSim is a football club management simulator. The player should be able to control the responsibilities of a head coach, sporting director and other club staff, but must not be required to personally carry out every routine task. Inspired by the *delegation concept* found in football management games, this is an independent FootClubSim rule/UX design, not a copy of another product's interface or proprietary implementation.

## Owner-approved decisions

1. **Default:** on starting a career, the player controls all implemented managerial responsibilities, including lineup/formation, tactics, training, player contracts and staff contracts as those systems become available.
2. **Per-category choice:** the player can separately determine **which responsibilities are performed personally and which are assigned to staff**. Do not make this an all-or-nothing "coach vs director" role switch.
3. **Decision authority must be explicit:** where a responsibility is delegated, a named eligible employee/role is responsible for its decisions. The player can change assignments later without starting a new career.
4. Staff delegation never removes the player's option to take back control of a responsibility.

These principles are approved; individual settings, third-party-game parity, exact menus, roles and rollout scope below are implementation proposals until verified.

## Proposed responsibility catalog

The initial settings should have separate rows rather than one global staff toggle. Split further where users need materially different decision rights:

| Area | Suggested separable responsibilities | Example employee role | Expected milestone |
| --- | --- | --- | --- |
| First-team match preparation | Formation, starting XI and bench, individual roles, pre-match tactics | Assistant manager / first-team coach | M2 |
| Match-day management | Substitutions, tactical adjustments and absences | Assistant manager | M2 after match-command model exists |
| Training | Team training schedule; individual development priorities; intensity/recovery | Assistant manager / coaches | M3 |
| Player recruitment | Scouting assignments, shortlists, transfer targets, offers and negotiations | Sporting director / head scout | M3 |
| Player contracts | Initiating renewals, negotiating terms, approval/signing | Sporting director | M3 |
| Club staff | Hiring/firing decisions, staff contract negotiations/renewals | Sporting director / general manager | M3 |
| Youth | Academy recruitment, youth development, youth promotion | Academy director / youth coach | M4 |
| Media and routines | Press, routine briefings, friendlies and other optional administrative tasks | Assistant manager / press officer | Future after relevant systems exist |

No unavailable responsibility should be shown as a working interactive setting. Role names are illustrative; actual staff competencies and appointment rules require design.

## Delegation modes (proposed UX)

Each responsibility supports a choice of decision authority:

- **Player:** only the player can finalize ordinary decisions in the area (default).
- **Employee:** designated staff member decides and commits within applicable rules and budget without asking every time.
- **Employee proposes, player approves:** staff prepares a recommendation or provisional proposal; the game waits for the player's explicit confirmation before commitment.

The distinction between **proposal** and **authorized commitment** must be explicit. It is acceptable to add the third mode alongside the first implementation if all three cannot be delivered in the same milestone; do not pretend it works before tested. An informational advisory view can be offered even in player-controlled areas.

## Behavioral invariants for future implementation

- **Separate assignment per responsibility** stored with the career, not as an external browser-only preference. Use stable internal responsibility and staff IDs and version the persisted contract.
- **Runtime validation:** only an existing, employed, eligible staff member with the necessary role/permission may be assigned. Vacant positions or fired/ineligible employees must trigger an explicit reassignment request or a documented safe, visible fallback to the player, never hidden autonomous behavior.
- **Effective actor and audit trail:** each consequential command identifies its initiating actor, assigned authority, decision context and resulting state revision. Never attribute staff actions to the human user.
- **One authoritative command path:** both human and AI decisions pass through the same budget, registration, discipline, eligibility and game-state validators, with atomic commit and replay/idempotence guards. Delegation must not grant rule-bypassing privileges.
- **Conflict of interest:** employees may not independently authorize their own hiring, dismissal, employment terms or other privileged transactions about themselves. Escalate to the player or a legitimately authorized board role.
- **Override:** the player can reclaim a responsibility at any time. A switch applies to **future** decisions; already finalized contracts or match events are not silently undone. Define how outstanding approval requests and tentative plans are invalidated or reassigned.
- **Deadlines:** no important mandatory decision (e.g. lineup before kickoff) may deadlock career progress indefinitely. Define deterministic safe failure handling; ask the player rather than silently executing an invalid or costly action.
- **Reporting:** automated decisions appear in a searchable career/activity history and concise inbox notifications. Avoid flooding the user with unimportant routine actions.
- **Determinism/offline:** employee AI is local, reproducible from game state, employee ability, rules version and explicit seeds; no cloud model or mandatory network service.
- **Practical usefulness:** staff competency should make a difference in decision quality; delegation is not a hidden shortcut with omniscient AI.

## Phased delivery and tests

- **M0:** document the complete delegation/authority contract, proposed responsibility IDs, serialization boundaries and negative test plan. No playable staff AI is claimed.
- **M1:** build only the common deterministic game/match contracts needed by future consumers; no management AI work ahead of approved M0 exit.
- **M2:** include per-area user vs staff control for available match-preparation responsibilities (especially lineup and tactics), with explicit visibility and override. Staff types may be synthetic placeholders in the initial fictional pack. Other settings may be marked as future, not silently represented as functional.
- **M3:** expand to training, recruitment, player/staff contracts and finances with assigned authorized employees, approval workflow and audit log.
- **M4+:** academy, youth, media and additional optional responsibilities when these systems exist.
- **Validation:** test default-all-player, different actors for lineup/tactics/training/contracts, rejected unauthorized staff decisions, missing/fired staff, pending approvals, manual override, conflicting employee transactions, same-seed deterministic AI, save/reload of assignments and duplicate-command safety.

## Relationship to existing design

This **amends** provisional D01 and D02 in [M0_PRODUCT_DECISIONS.md](../M0_PRODUCT_DECISIONS.md). The human is not permanently forced into a coach/director combination; that is merely the **default distribution of authority**. Club board goals and external competition rules cannot be disabled by delegation. [ROADMAP.md](../../ROADMAP.md) should reserve a minimal user-visible delegation mechanism in M2 and fuller staff management in M3.

## Open design details

Employee skill model and assignments, whether match-day changes are allowed in the initial automatic engine, granular vs bulk setting presets, UI information architecture, escalation/notification thresholds, emergency roster policies and exact staff recruitment system remain proposals, not accepted details.

**M0 exit remains open** until the rest of its independent acceptance and two-pass audit criteria are passed. M1 must not start automatically after M0.
