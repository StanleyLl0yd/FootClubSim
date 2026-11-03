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
- A **v2** entry must replay the dense physical v103 shot/referee source,
  including on cold reload; the legacy v8 replay fallback is legal **only**
  for entries without `disciplinePolicyVersion`. Identical persisted v105
  source bytes may independently satisfy both referee modes: replay checks
  canonical event validity, **not cryptographic origin attestation**. A v2
  label cannot authorize an event that fails the actual dense replay.
- A journal can progress from old entries to v2 entries, never downgrade
  to an old-policy entry after v2 begins. Unknown versions and extra claimed
  authority are rejected by the exact-source validator.
- Caution history and its zero-duration bookkeeping are derived exclusively
  by re-generating the same seeded source. No client-supplied list of
  cautions, bans, clearances or referee decisions is accepted.
- This is applied by the existing `prepareM1V188LeagueMatch`,
  `applyM1V188LeagueMatch`, v188 IndexedDB store and source replay, not
  a separate diagnostic engine.


## Replay-derived hold/expiry inspection

The playable v188 journal now provides `inspectM1V188FictionalHolds`.
It fully validates the historical journal (or reuses only an exactly
byte-matched, previously verified in-process prefix) and derives source
fixture ID, club, player, hold reason, missed **own-team** fixtures,
actually served own-team fixtures, remaining fixtures and the last
scheduled blocked fixture. In-match warnings are not copied into a
caller-controlled suspension history; the inspector omits zero-duration
caution bookkeeping and never edits persisted v188 bytes. Historical
v188 entries still replay under their stored discipline policy.

The inspection result explicitly reports `externalKdkAuthenticated:false`
and `officialClearanceAuthenticated:false`. Fictional automatic expiry
is **not** an official decision to reinstate a player. The selected
playable `prepareM1V188LeagueMatch` and `applyM1V188LeagueMatch`
paths accept an optional external-discipline claim argument solely to
**reject** it with `UNVERIFIED_EXTERNAL_DISCIPLINE`; even a submitted
empty list is not an authenticated complete official snapshot. Without
that argument, the previous internally fictional gameplay remains
unchanged. External KDK orders, authenticated appeals, cancellations,
reinstatement and retroactive conflicts remain outside this feature.
This is partial P3-3 progress, not ACCEPTED.

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
