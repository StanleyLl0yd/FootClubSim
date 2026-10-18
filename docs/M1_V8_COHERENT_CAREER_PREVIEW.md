# M1 P4: coherent v8 pure career batch preview

**2026-10-18. Research-only domain transaction, NOT official league posting or
production persistence.**

`src/core/m1-v8-coherent-career-preview.ts` exposes
`applyM1V8CoherentCareerPreviewBatch(initial, priorJournal, requests)`.
It calls the existing strict v8 schema-4, **1..16-command atomic pure batch
transition** first. If any proposed fixture is stale, duplicate, interrupted,
forged or otherwise invalid, it returns the original typed domain rejection:
**no new journal or partially calculated view is exposed** and caller inputs
remain unchanged.

Only after all commands are source replayed and accepted does it derive
three independent, validated **read-only** projections of the exact new journal:

- 240-fixture synthetic round/club coverage and pending fixtures;
- original v8 team/player season performance, including medical presence and
  credited penalty/own-goal statistics;
- conventional **unranked, unofficial 3/1/0** match-result points.

The new wrapper checks that all three projections agree on the same
`careerId`, journal revision, completed fixture count, club IDs,
per-club completed games and goals for/against. Disagreement fails closed as
`INTERNAL_INVARIANT`; the caller receives no proposed next journal.
It does **not** change any of the three established projection contracts,
and does not add official points to the result journal.

**Correctness-first cost:** all three selectors fully revalidate and replay
the newly proposed journal independently. This deliberately avoids giving
untrusted, in-process callers an unsafe prevalidated-journal projection API,
but performs redundant calculations and may block the browser main thread.
Full 240-fixture latency, true storage exhaustion, and Worker/CAS production
integration require separate measurement and design before acceptance.

**Hard boundaries:** this function does not persist anything. Real browser
writes still require the separate atomic IndexedDB CAS procedure; callers
must not treat a returned preview as an acknowledged saved career. Source
referee/medical decisions are not authenticated. No official RPL ranking,
KDK sanctions, automatic fatigue/condition changes, forfeits, match awards,
league standings, contracts, or transfers are produced. Source rules,
regulation exceptions and license verification remain open.

The immutable M0 initial career, all older M0/v3-v7 saves and v8 journal
schema-4 are unchanged. No M2 functionality is authorized. M1-P3 #29,
M1-P4 #30, M1-P5 #31 and exit #3 remain open pending full integration,
statistical calibration, and two repository-wide audits.
