# M1 P3: both-club modelled discipline preflight and actual source match (v58)

The existing v56 modelled automatic-sanction checker can approve a single
club for its next synthetic fixture. That is not enough to play a game:
a club's opponent must be checked **against the same source career history**
before any goals or match events are generated.

`simulateM1V58TwoClubDisciplineGatedFixture` requires the full original
initial career, replayed schema-6 journal, synthetic prematch and coach
policy. It validates BOTH original team sheets, including named reserve
players, against the full relevant previous match history before running
v29 causal referee/medical match generation and v31 source-replayed
physical exposure. A missing prior match for either team produces a
typed error and no synthetic match result. Inconsistent current lineup
or a retroactively discovered modelled automatic-ban violation fails
before source calculation.

It prevents the old loophole in which a caller could legitimately check
only the controlled club, then simulate against an opponent whose
matchday sheet contained a player with a still-pending automatic
modelled ban. Both clubs' admissions are retained in the new read-only
versioned result alongside the actual match report; all checks bind to
the identical journal revision and original catalog.

Synthetic prerequisites are intentionally conservative: all earlier
canonical rounds for each club must be represented. In particular,
postponed or rescheduled matches cannot be treated as if they had
already been played. Nothing updates storage or advances the career
implicitly; the caller must explicitly commit through the unchanged
source-replaying career CAS after a successfully accepted match.

**Not real-world authenticated:** this is an opt-in deterministic
fictional competition rule path, not evidence that the RFU or the
real referee/physician confirmed sanctions or player fitness.
Second-yellow/4-YC automatic rules are modelled, while unresolved
straight reds still fail closed without KDK-specific adjudication.
No medical recovery, appeals, conditional bans, rescheduled
official calendar or league-level corruption cleanup is claimed.

Tests cover first fixture, real v29/v31 gameplay, both-club full prior
history, incomplete history for either club, mismatched source,
bad coaching policy, malicious getters, tampered match report and
unchanged source journal.

P3 #29 stays OPEN pending full referee/medical life cycle and actual
normal-game entrypoint wiring. P4 and M2 are untouched.
