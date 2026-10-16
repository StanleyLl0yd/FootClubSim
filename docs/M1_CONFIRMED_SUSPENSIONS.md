# M1 P3: confirmed match-specific suspension gate (limited)

**Status:** partial domain validation only, 2026-10-16. Milestone M1 remains open.

`src/core/m1-confirmed-suspensions.ts` introduces a **separate schema 1**, read-only pre-match lineup gate. It accepts only a separately authenticated, complete snapshot of *already-issued* suspension rulings, each listing an explicit set of synthetic fixture IDs affected by that ruling. It never estimates a ban from a red card, a fourth yellow card, a calendar round or a suspended match's date.

## Enforced invariants

- Validate the entire M1 prematch first. Match fixture ID, round and home/away sides must equal the deterministic synthetic season schedule; a fake fixture ID is not a loophole.
- Each ruling has exact fields, a unique stable `rulingId`, a registered member of the named club and between 1 and 30 unique fixtures belonging to that club; at most 256 rulings in one trusted snapshot. Two orders may not claim the same player in the same fixture without explicit external consolidation.
- A player banned for the current fixture **cannot be included in the starting XI or on the named bench**. Denial is a typed `SUSPENDED_PLAYER` result identifying blocked players. Valid bans for players not on the current match sheet are reported to the squad-selector caller.
- Other fixtures are unaffected unless explicitly listed in an authentic order. Inputs remain unchanged. The check has no side effects and does not rewrite previous matches, roster sources, save formats or v6/v7 reports.

## Source / authentication boundary

- [RPL 2026/27 regulations](RPL_2026_27_RULES.md), article 20.6 and related disciplinary clauses, indicate unserved suspensions and a distinct exception for automatic fourth-caution sanctions. The **complete accumulation, appeal, stay, expiry, rescheduling and KDK decision semantics are NOT implemented**. No inferred card-to-ban duration is lawful at this stage.
- Match bans must be delivered by an **external trusted authority adapter** and bound to the correct authenticated career/season revision before using the pure gate. A browser-supplied `trustedRulings` array is not proof of authority. In particular, an untrusted empty array could improperly allow a suspended footballer to play; completeness and freshness must be verified outside this module. Do not call the gate directly with editable local JSON and assume it is authoritative.
- Synthetic deterministic fixtures are **not** official RPL fixture dates. A round is not assumed to mean a completed chronological match; postponed fixtures and sanctions spanning seasons need separate official policy.

This is a step toward M1 P3 #29 and P4 #30 but **does not** create a trusted career CAS, calculate suspensions automatically, or implement medical clearance, regulatory appeals, suspended-match completion or persistence. All M1 milestones and exit #3 stay open; M2 remains unauthorized.
