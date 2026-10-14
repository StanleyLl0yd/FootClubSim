# IFAB Laws 2026/27: RFU-announced change leads (research only)

**Reviewed 2026-10-14.** The [RFU official publication dated 24 June 2026](https://www.rfs.ru/news/224570) announces a Russian-language edition of the **2026/27 IFAB Laws of the Game**, effective **1 July 2026**. This is a selective official **press-summary cross-check**, NOT article-by-article review of the full published lawbook, not a league-specific 2026/27 RPL exception source, and not an executable game rules pack.

| IFAB law cited by RFU | Officially announced change (paraphrased) | Future FootClubSim event/rules dependency | Status |
| --- | --- | --- | --- |
| Law 3, players | Substituted player expected to leave the field within 10 seconds; on exceeding that, incoming player may enter at the first stoppage after one minute of resumed play | Distinguish `substitute-requested`, `player-off`, `substitute-eligible-to-enter` and `player-on`; match-clock and stoppage semantics must not incorrectly count the incoming player on the pitch during the delay | **NOT IMPLEMENTED**; full exception text unreviewed |
| Law 3, international friendlies | Senior A international friendlies may permit 8 substitutions, or 11 with consent/notification, subject to a three-opportunity restriction | **Do not import this international-friendly exception into RPL**. Verify RPL-specific substitutions using its competition rulebook | **NOT APPLICABLE** to ordinary RPL by this announcement alone |
| Law 5, referee and VAR | Expanded VAR review indications include manifestly wrong second caution and mistaken penalized player; immediate/no-delay wrong corner review depends on competition-organizer activation | VAR state and competition-specific enablement; card corrections must not be counted twice or charged to wrong player | **NOT IMPLEMENTED**; RPL VAR enablement and exceptions unverified |
| Law 5, medical examination | A player may have to remain off-field for one minute after certain injury assessments/stoppages | Temporary absence must be distinct from a permanent substitution or card; inspect complete IFAB exception clauses | **NOT IMPLEMENTED**; exceptions unverified |
| Laws 10/14, penalties | Revised consequences for kicker's accidental second touch and simultaneous infringement by keeper and kicker | Penalty state must distinguish match play from shootout and encode the exact ordered violation/correction outcomes | **NOT IMPLEMENTED**; precise restart/outcome rules unverified |
| Laws 15/16, restart | Announced five-second restriction for throw-ins and goal kicks | Validate restart timing and resulting sanction from full primary Laws before any executable timeout logic | **NOT IMPLEMENTED**; exact enforcement text unreviewed |
| Laws 4/5, equipment and officiating | Equipment/covered accessories allowances and optional body cameras for match officials | No automatic gameplay mechanic in M0; retain as non-simulation law dependencies only if later features require them | **NOT IMPLEMENTED** |

**Important:** An RFU announcement is evidence that these changes were *announced*, not the full authoritative wording, applicable exceptions, cross-competition adoption policy, or any named match adjudication. The M0 `MATCH_LEDGER_VERSION=1` accepts only shots and full time and cannot legitimately simulate these behaviors. The M1 event schema must be **separately versioned** before introducing player-off delays, card rescission, VAR interventions, stoppages or penalty details. Do not fit invented outcomes into the M0 shot ledger.

## Verification and dependencies to complete later

1. Open the complete [official RFU 2026/27 Laws publication](https://www.rfs.ru/news/224570) and the underlying lawbook, verify exact clauses, all exceptions, sanctions and restart order.
2. Reconcile those rules with the [2026/27 RPL regulation source matrix](M0_RPL_RULES_MATRIX.md), effective competition circulars and RPL decisions. Friendlies, international matches and Cup rules are **not automatically** RPL rules.
3. For each future executable branch, add a versioned source ID, law/article, effective date, synthetic positive/negative/clock-boundary cases and clearly defined event transitions.
4. Implement a deterministic M1 match-event extension only after the M0 exit gate and explicit M1 authorization, then finalize RPL competition-specific execution and rights review at M2.

**Status:** source change *leads documented*, **no** validated all-laws implementation, no new game events, no source PDF or copyrighted prose copied into the repository. This does **not** close [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15) or M0 [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).
