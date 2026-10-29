# M1 P3 v84: modelled one-match bans in the interactive lineup path

After v82 excludes unresolved modelled injury withdrawals,
`proposeM1V84MedicallyAndAutomaticallyEligibleLineups` additionally
checks *both* clubs through the existing fully source-replayed
v56 automatic-discipline admissions before generating a new match.

The v84 proposal builds a valid v82 medical-aware XI/bench, invokes
v56 for home and away, and only if v56 rejects with the narrow
`CURRENT_LINEUP_BLOCKED` automatic one-match reason does it
exclude the affected registered players and re-propose an XI and
bench. Every changed candidate goes through both v56 gates again.
No source journal is modified by a proposal. The number of retries
is bounded by original registered roster sizes.

All other denials fail closed, including incomplete earlier fixtures,
historical violations, invalid source, unresolved straight-red KDK
decisions, unsupported appeals or insufficient registered players.
No synthetic one-match duration is invented for a direct red card.
The v82 modelled medical holds cannot be bypassed by additional
disciplinary exclusions.

The v80 experimental browser career now uses the v84 proposal
before simulating a fixture. It still requires the independent
v75/v76 combined medical and both-club discipline source gate and
native IndexedDB CAS at persistence time; stale revisions remain
uncommitted. Neither M0 React shell, production PRNG, journal schema,
nor deferred P4 batch API is modified.

Existing v56 seeded tests exercise the four-distinct-caution
automatic match ban; v84 adds explicit first-match and fail-closed
regressions. A *dedicated multi-match v84 ban-and-replacement native
browser acceptance* and official KDK/referee/medical authentication
still need implementation. In particular, v84 is NOT an appeal,
authentic suspension order or recovery clearance. Per-match
journal replay cost and UI responsiveness are not release accepted.

P3 #29 OPEN; P5 #31 OPEN; P4 #30 deferred. Both full
repository-wide audits #3 required, M1 OPEN, M2 prohibited.
