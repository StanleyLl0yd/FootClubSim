# M1 P3/P4: source-replayed v8 dismissal continuity

**Status: synthetic observations, not an official suspension or eligibility
decision. No M2 gameplay implementation.**

`deriveM1VerifiedV8DisciplineContinuity(initial, journal)` first validates
and replays every fixture in the independent schema-4 v8 result journal.
It then inspects each verified match dossier for second-yellow and straight-red
dismissals, preserving the club, player, exact fixture, round, dismissal
kind and cautions recorded within that match. Single yellow cards are not
treated as dismissals.

A separate list records subsequent round-numbered matchday sheets for the
**same** club/player, distinguishing:

- Starting XI;
- Substitutes who actually entered play;
- Named substitutes who were never used.

The comparison follows the canonical fixture round rather than the order
in which results were appended to the journal. The most recent previous
dismissal is linked to each later listed appearance without rewriting any
earlier record. A dismissal in a fixture never creates a warning for that
same fixture. Absence from an intervening matchday sheet does not imply
a ban, and neither does being listed prove medical or sporting clearance.

**Authority boundary:** a confirmed red card or second yellow is a
match-local event. Exact subsequent suspension windows, cumulative-yellow
thresholds, annulments, appeals, competition exclusions and rehabilitation
require independently authenticated and effective RFU/RPL/KDK decisions and
rules. A source-replayed local journal can validate its *own* supplied
facts but cannot authenticate their real-world origin. For a separately
provided *confirmed* fixture-specific suspension feed, use the existing
`reconcileM1V8ConfirmedSanctions` gate: do not turn these observations
directly into automatic bans or results/points deductions.

This report is read-only and changes no match engine, medical state,
competitions, contracts, old M0/v3-v7 saves, v8 journal schema, IndexedDB,
or league standings. It provides partial evidence for #29/#30 only.
M1 #27-#31, exit #3, and M2 authorization remain OPEN.
