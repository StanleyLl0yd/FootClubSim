# M1 P3 v63: synthetic next-fixture medical precaution

This is an **opt-in, versioned, replay-bound** pre-match safeguard
against accidentally naming a player who had a permanent MODElLED
injury-withdrawal in the immediately preceding canonical fixture
of their synthetic club. It is not a physician's diagnosis or a
verified minimum treatment interval.

The new v63 entrypoint requires the original M0 career and a fully
replayed schema-6 v32 journal, plus current source-catalog prematch.
It checks BOTH clubs' v56 automatic disciplinary eligibility before
looking for injury withdrawals; missing prior fixtures, corrupt
historical facts and unresolved direct reds fail closed. The nearest
prior club fixture is determined by **canonical synthetic round**,
not journal posting order.

If a player in the previous match has positive
permanentInjuryWithdrawals in its source-derived per-player exposure,
the player's inclusion in the very next club fixture (XI OR named
bench) is denied with a typed club-specific error and source fixture
ID. A player who sits out a fixture is not held forever by this
particular *one-next-match precaution* rule. That is an explicitly
arbitrary gameplay safeguard, NOT clinical clearance. More prolonged
injury statuses cannot be inferred from the source.

The playable v63 wrapper calls the existing v58 both-club discipline
match path only after this new screening; historical journals are
unchanged, and the result is completely verifiable by independent
replay. No new persistent storage or schema changes. No clinical
diagnosis, independent medical or referee authority, source-confirmed
severe injury, concussion procedure, KDK direct-red adjudication or
statistical calibration is claimed.

P3 #29 remains OPEN. P4 is untouched. M2 prohibited.
