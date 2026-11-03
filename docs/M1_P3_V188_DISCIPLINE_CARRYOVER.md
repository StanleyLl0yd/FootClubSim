# M1 P3-3: playable v188 fictional caution carryover

The integrated v188 two-team league source now replays **simple cautions across
club fixtures**, not only the two cautions within one match. Every fourth
distinct simple caution in this fictional competition creates a one-own-team-game
hold, which excludes the player from both XI and bench on that club's next
scheduled game. A second caution in the same match still creates the existing
one-own-team-game dismissal hold; the fictional direct-red three-game hold and
source-seeded injury withdrawal durations are unchanged.

## Replay and save compatibility

- The source entry has an explicit `disciplinePolicyVersion: 2` for **new**
  commits. The request format and v188 journal root remain unchanged.
- Old entries without this property replay under the original per-match
  caution rule. Their first simple cautions still inform later v2 counts
  without retroactively changing past lineups or journal bytes.
- A journal can progress from old entries to v2 entries, never downgrade
  to an old-policy entry after v2 begins. Unknown versions and extra claimed
  authority are rejected by the exact-source validator.
- Caution history and its zero-duration bookkeeping are derived exclusively
  by re-generating the same seeded source. No client-supplied list of
  cautions, bans, clearances or referee decisions is accepted.
- This is applied by the existing `prepareM1V188LeagueMatch`,
  `applyM1V188LeagueMatch`, v188 IndexedDB store and source replay, not
  a separate diagnostic engine.

## Explicit limitations

This is **fictional gameplay policy**, not the RFU/KDK's actual sanction,
appeal, cancellation or reinstatement process. No official external order
feed is authenticated; real-world rules and unresolved orders may not be
treated as cleared by modelled ban expiry. The existing second-yellow,
straight-red and temporary-treatment models remain synthetic. Rescheduled
fixture and medical-exception admission are not solved here.

P3-3 remains OPEN until its complete verified in-match, cross-match,
authority/appeal/expiry and typed-refusal criteria are accepted on the final
playable source. P3-2/P3-4 and P5 remain OPEN; M1 and exit audit #3 remain
OPEN, M2 forbidden, holdout 2024/25 sealed.
