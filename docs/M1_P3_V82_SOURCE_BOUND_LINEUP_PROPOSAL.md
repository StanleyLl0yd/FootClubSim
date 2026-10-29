# M1 P3 v82: source-bound medical-hold lineup proposal

v63 denies any XI or bench that names a still-unresolved modelled
permanent-withdrawal participant. In the v80 clickable M1 prototype,
fixed default lineups therefore cannot advance once any named player
has such a hold. Merely retrying with a new RNG seed would be both
unfair and unsafe.

v82 adds a small *proposal* API,
`deriveM1V82SourceBoundAvailableLineups(initial,journal,fixture)`.
It verifies the **entire untrusted schema-6 journal** against the
original immutable M0 career, confirms exact synthetic fixture
identity and replays all earlier relevant medical withdrawals from
source facts, in chronological round order. Any historical use of
a player after a prior unresolved hold fails closed.

For the fixture's two clubs, v82 proposes a registered XI with
exactly one eligible GK and ten eligible outfield players, and a
bench containing only eligible registered players. Original roster
order is preserved when possible; foreigner, keeper and bench limits
are checked using the existing strict M0 validator. If a club lacks
eligible players, the entire proposal is rejected. The function
never grants recovery, treatment, future fitness or discipline
clearance and never mutates the source journal.

**Critical security boundary:** v82 does **not** admit or persist a
fixture. The caller still has to create a source-replayed v31 match
and submit it through the independent v75/v76 medical plus both-club
discipline gate and native IndexedDB CAS. The v76 gate must always
revalidate the snapshot at write time. There is no fallback to the
ungated v32 batch endpoint.

Modelled permanent withdrawals still do not expire, and v82 does not
authenticate actual physicians, referee/KDK decisions, exceptions,
diagnosis, severity or treatment. It is a deterministic playable-
prototype lineup substitution for registered healthy roster members,
not a medical discharge protocol.

P3 #29 remains OPEN; P5 #31 remains OPEN; P4 #30 deferred;
both full exit audits #3 still required; M1 OPEN, M2 prohibited.
