# M1 v7: confirmed penalties and own goals (limited)

**Scope: P3 #29, 2026-10-16. Not an M1 acceptance or playable season release.**

`src/core/m1-v7-adjudications.ts` introduces a separate **engine version "6", event schema 7, decision schema 1**. The existing v6 engine, random stream (five draws per phase), historical IDs, journals, standings and M0/v3-v5 readers are unchanged. A v7 result embeds an exact v6 result plus an ordered, versioned wrapper stream. Legacy v6 results are not silently reinterpreted as v7 records.

## Supported subset

- **Penalty kick in match play**: only an already-final, separately referee-confirmed `scored`, `saved` or `missed` outcome. The identified taker must still be on the benefiting club's active XI at the checkpoint. A goalkeeper may take a penalty. A scored penalty increments the benefiting team's total goals and penalty goals. Every finalized attempt counts as a shot; saved and scored kicks also count as shots on target. The original v6 open-play stream and RNG do not change. **The current xG sum covers open-play shots only** (the report explicitly sets `xgCoverage: 'open-play-only'`); no made-up penalty xG is added.
- **Own goal**: an expressly confirmed own goal identifies an active player of the **opposing** club. Credit goes to the benefiting club, not to the defender's club or a fabricated attacking shooter. It does not create an extra shot or xG; confirmed own goals are tracked separately.
- Each decision has a unique stable ID, exact allowed fields, fixture ID, benefiting club ID and an integer checkpoint in `[0, 5400)`, divisible by 300. Decisions must have strictly increasing checkpoint times, at most 18 per match. Decisions are applied **after** v6 substitutions/dismissals at the same virtual checkpoint and **before** any subsequent synthetic shot.
- Validation fails closed for inactive/wrong-team players, malformed decisions, repeats, collisions with v6 command IDs, wrong fixtures, unknown outcome codes, unsupported penalty retakes and late/out-of-order events.
- `verifyM1V7Result` recomputes the whole proposal from separately supplied trusted source inputs and compares the canonical result. A forged/tampered result cannot be accepted merely because its internal sums agree.

**Trust boundary:** the caller is responsible for authenticating the referee controller and for ensuring that its decision is final and compliant with the 2026/27 competition rules. A public browser caller claiming to be a referee, or sending a syntactically correct JSON decision, does **not** establish this. The current API intentionally does not generate penalty awards, fouls, own goals, review decisions or authorization from a simulation draw. Its special events are confirmed external adjudications only. Do not use it for untrusted M2 persisted career commits.

## Rules and evidence

Official primary sources, as reviewed for this narrow contract:

- [IFAB 2026/27 Law 14, The Penalty Kick](https://www.theifab.com/laws/latest/the-penalty-kick/): direct penalty goal is possible; identified taker and refereeing procedure govern legality. Infringement, simultaneous offences, accidental second touch, saved/rebounded attempts and retakes have distinct consequences. A raw kick outcome alone is therefore **not** a legally final decision.
- [IFAB 2026/27 Law 10, The Outcome of a Match](https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/): the resulting team score must be derived consistently. An own goal credits the opposition; this is kept distinct from an open-play scorer attribution.
- [IFAB 2026/27 Law 5, The Referee](https://www.theifab.com/laws/latest/the-referee/): only appropriately authorized match officials can determine the final scoring decision. The engine's schema cannot authenticate officials.
- [RPL 2026/27 rules provenance](RPL_2026_27_RULES.md) and [2026/27 unresolved exceptions](IFAB_2026_27_CHANGE_NOTES.md): this is not a full competition-specific adjudication or registration/discipline implementation.

The official `latest` URLs are mutable. Record and revalidate the 2026/27 edition before declaring a final lawful rules pack; no primary-source text is redistributed here.

## Explicit outstanding work

True referee/VAR decision state machine and stoppages; validated offence/penalty-award generation; detailed Law 14 encroachment, keeper offences, accidental second touches and retakes; temporary medical off-field procedure, reinstatements and concussion exceptions; cross-match suspensions; season-wide scoring attribution; v7 trusted career CAS/journal, abandoned matches and stat-calibrated auto generation. New v7 scores are intentionally **not** passed to the v6 journal validator, whose `goals <= shotsOnTarget` invariant is incompatible with goals scored without normal open-play shots.

P3 #29, P4 #30, P5 #31 and M1 exit #3 stay open. M2 requires independent owner acceptance.

## Verified player attribution projection

`src/core/m1-v7-appearance-report.ts` adds a read-only projection after **full v7 replay verification** plus independent verified v6 appearance reconstruction. Player appearances remain based on the same real substitution/removal chronology.

- Successful penalties count as taker goals, penalty goals, attempts, shots and shots on target; saved kicks count as attempts, shots and shots on target; missed kicks count as attempts and shots.
- Own goals remain attached to the **defending player** as `ownGoals`, not miscredited as a scorer from the benefiting club.
- `goals[]` retains chronological goal attribution: `open-play` and `penalty` entries have a `scorerId`; `own-goal` entries have a `defenderId`. Attribution IDs preserve v7 event identity and are verified against aggregate team totals.
- Existing v6 caution, dismissal, medical-withdrawal and played-time summaries are embedded unmodified. The report does not impose disciplinary sanctions or create a career persistence transaction.
- Player/team xG still covers **open play only**; the independent penalty-xG model is not implemented. No fabricated player ratings or scorer identities.

The reporter rejects a candidate with a changed score, events or mismatched trusted decisions. This is **not** authorization of the source authority itself or M1 P4 closure.
