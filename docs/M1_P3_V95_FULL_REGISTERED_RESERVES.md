# M1 P3 v95 - full-registration reserve recovery after automatic ban

The existing v82 medical source projection proposes at most
11 starting XI + 12 bench players, even if the source-verified club
registration has more eligible players. In v84, a subsequent
automatically verified one-match suspension causes the lineup
selector to filter **only those initial 23 names**. On a club with
24+ fully registered players, this needlessly leaves eligible
reserve players invisible and can reject a legal XI/bench.

v95 makes a narrow **source-bound proposal** correction inside
`src/core/m1-v84-automatically-eligible-lineups.ts`.
After a v56 automatic-discipline gate rejects a named XI or
bench player, the selector recomputes candidates from the
**original source-verified full club registration**, excluding:
1. Every unresolved medical withdrawal from the fully replayed
   v82 `excludedMedicalPlayers` for that *same club*
2. Every v56 automatically blocked player for the same club

It still chooses one eligible goalkeeper and ten eligible
outfield players, up to 12 bench players, and invokes the same
strict M0 lineup and foreigner limits. Every proposed change
goes through *both clubs'* independent v56 source gates again.
Malformed, sparse, historical, direct-red or medically
unresolved authority claims all still fail closed. The next
match is persisted **only through v76 medical-plus-discipline
CAS**, and no old journal/engine schema is changed.

The new integration regression extends one *synthetic*
registered roster from 23 to 26 via distinct registered,
domestic outfield players and replays all eight first-round
source matches into a schema-6 journal. It chooses a source
second-yellow dismissal without an unresolved straight-red
for next-round participants, then asks v84 to assemble a
second-round match lineup. It checks the real suspended player
is in neither XI nor bench, all source medical holds remain
excluded, newly available source-registered reserves outside
the original 23 enter the bench if needed, and the complete
journal remains byte-identical. The selection itself is **not**
disciplinary authority, clinical recovery or a durable commit.

P3 #29 OPEN: internal source-referee/KDK adjudication, event
generation, real medical treatment and complete legal
multi-fixture acceptance remain. P5 #31 OPEN, P4 #30
deferred, M1 OPEN, M2 prohibited, exit audit #3 unperformed.
