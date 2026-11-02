# M1 P3/P5 v122 — source-replayed sequential dense ordinary fixtures

Builds the next **real 100-second v105 simulated fixture** from the same
immutable M0 club list, 30-round controlled-club schedule, competition
rules, legal physical starting XIs, tactics and a fixture-derived
deterministic seed. This is an explicitly bounded ordinary-match
mode, feeding the separate native v120 journal/CAS rather than
reinterpreting saved v8 events. The user interface can play and
commit successive games of the selected club, restart the browser,
and replay the complete strict v120 history.

**Safety boundary:** if ANY earlier v120 fixture contains a recorded
normal substitution, medical action, special adjudication or
referee command, automatic ordinary-season advancement fails
closed with `PREVIOUS_EXCEPTION_NOT_SUPPORTED`. Neither injuries
nor suspensions are silently cleared, and no player is allowed to
evade a known hold. Those event-rich cross-match integration
steps remain P3 work. No unseen opponent matches are fabricated.

This does not model live clock stoppages, realistic special goals,
cards/injuries, or valid off-field return in the dense v120 mode;
all such rates are *unimplemented*, not numerically zero in
football. The simulation remains an experimental fictional ordinary
season without authenticated source roles, not an accepted match
manager. Statistical P5 validation must follow correct definitions,
balanced cohorts, preregistered uncertainty and independent holdout
policy. M0/v8 journals and PRNG are unchanged.

Native Chromium/Windows browser smoke now checks a second
consecutively admitted fixture and restores a revision-2 journal
after reload, without changing the existing v8 career history.
Unit tests independently replay four successive source games
and reject altered earlier results. A 30-match workload/performance
SLA has not been demonstrated by these four fixtures.

P3/P5/M1 OPEN, P4 deferred, M2 prohibited, exit #3 0/2 full audits.

## Canonical ordinary source admission (v164 hardening)

Both v120 journal admission and complete historical replay require the
`v122-ordinary-<fixture>` namespace to carry the exact canonical fixture
seed derived from the immutable career RNG. Ordinary requests must also
contain no referee, substitution, medical or adjudication commands.
An otherwise fully replayable simulation with a changed seed is rejected;
legacy namespaces are not implicitly authenticated. This check does not
prove that an externally supplied referee/medical claim is genuine, certify
all lineup/tactics fields or change saved journal versions.
