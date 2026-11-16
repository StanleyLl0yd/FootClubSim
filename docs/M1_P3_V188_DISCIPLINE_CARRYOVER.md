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
This is the intentionally fictional sanction-policy implementation. Its complete P3-3 acceptance, including mandatory refusal of unauthenticated real KDK/appeal claims, was subsequently recorded on exact main (see final section below).

## Explicit limitations

This is **fictional gameplay policy**, not the RFU/KDK's actual sanction,
appeal, cancellation or reinstatement process. No official external order
feed is authenticated; real-world rules and unresolved orders may not be
treated as cleared by modelled ban expiry. The existing second-yellow,
straight-red and temporary-treatment models remain synthetic. Rescheduled
fixture and medical-exception admission are not solved here.

## P3-3 formal acceptance boundary (2026-11-12)

The [all-three-criteria review](https://github.com/StanleyLl0yd/FootClubSim/issues/29#issuecomment-6826198408) accepted the existing
fictional, source-replayed discipline lifecycle on protected exact
`main=21bfe37906a905f94900c9475e1694fc6a7fc767`, **9/9 required
CI PASS**. The later medical-v5 full playable season also passed exact-head
Core and native browser checks (PR #530). The approval explicitly treats
an **unauthenticated external appeal/order/clearance as refused input**, not
as a working RFU/KDK integration. Both-team verified eligibility, positive
bans and actual own-fixture expiry are within the fictional game model;
external approvals remain unsupported. **P3-3 ACCEPTED**; P3-2/P3-4 and
P5-2/3/4/5 stay OPEN, M1 and the two full audits OPEN, M2 prohibited and
2024/25 holdout SEALED.

## P3-4 candidate: in-game source-seeded fixture postponements (not yet accepted)

The existing 240-fixture v188 journal now has an **opt-in**
`fixtureCalendarPolicyVersion: 2` on its **existing source entries**.
The version-2 calendar preserves all 240 match IDs, two fixtures per
club per home/away pair, original round labels, physical referee source,
player condition and both-team eligibility. It deterministically moves
the first opening-round fixture into the third matchday sequence and
the first second-leg fixture into the eighteenth matchday sequence,
with a small seeded within-week destination offset. The
first game of the next source round is advanced into the opening
slot, so the default managed club can still play immediately,
while the original opening fixture is genuinely postponed.

The schedule is internal **fictional game chronology only**. The
original match ID/round remains intact, so the UI can label a delayed
fixture without impersonating a Russian Premier League calendar or
claiming a weather bulletin, medical opinion or RFU/KDK approval.
`externalLeagueReschedulingAuthenticated:false` stays explicit.
The canonical schedule is regenerated from the fixed initial-career
seed and source version, not from user-supplied rescheduling claims.

Existing saves have **no** new calendar marker, preserve the old
fixture ordering, validate with the original v188 source and are
never retroactively rescheduled. The source marker is part of
every new v2 replayed entry; a changed marker or swapped match
breaks cold source verification. Holds are served by *actual
own-team matches played in the replayed order*, so a postponed
match cannot silently clear a sanction. The same actual journal
supports both managed and automatic fixtures.

This is directly tested against 24 genuine source fixtures
(including the deferred opening match), with full 240-fixture
real-browser native UI tests and a future prospective 48-career
P5 calibration required before final acceptance.
**P3-4 remains OPEN:** final source chronology,
all-source rescheduling evidence and any genuinely missing
externally authorized fixture changes still require evaluation.
