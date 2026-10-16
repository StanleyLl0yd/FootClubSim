# M1 P4: source-replayed v8 per-round match recap

**2026-10-16. Read-only synthetic matchday report, not a league table
or official playable-season implementation.**

The `deriveM1VerifiedV8RoundRecap(initial, journal, roundNumber)` projector
accepts only a fully replay-validated schema-4 v8 career journal, rebuilds
the accepted M0 synthetic double-round-robin fixtures and displays one
specified round in **original generated fixture order**. Each of the eight
fixture slots remains `pending` until a replay-verified completed result
exists. Pending matches have **null** scores, player-goal attribution and
disciplinary counters: not an invented 0-0 or forfeited result.

Completed results provide the final home/away score, credited scoring
events (including own goals/penalties), observed yellow and dismissal
counts and source-replayed event count. Because journal application may
happen out of calendar order, reported matchday order and completeness
come from the fixed fixture schedule, never the order of entries in storage.

An entire round becomes `complete` only when all its scheduled matches
were actually committed and verified. The reporting API does **not**
award league points, sort a table, make competition eligibility rulings,
simulate missing matches or update existing saves. It does not authenticate
real referee/medical claims or grant rights to official football data.

The module supplements existing fixture-coverage, match-timeline and
season-statistics projections under #30; it does not modify them or
their event/journal schemas. M1 exit #3 and any M2 authorization
remain open.
