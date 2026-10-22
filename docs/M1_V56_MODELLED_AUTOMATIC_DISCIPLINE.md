# M1 P3: enforce modelled automatic one-match sanctions (v56)

**22 October 2026. Controlled-club virtual league gate.**

Official [RPL 2026/27 competition regulations, article 20.6](https://www.rfs.ru/subject/1/documents/preview?documentId=2164)
describe the fourth warning in *different championship matches* as an
automatic-disqualification category. Official IFAB 2026/27 and RFU
disciplinary regulations distinguish second-yellow dismissals from
direct red-card offences requiring a separate KDK decision.

The opt-in `admitM1V56ModelledAutomaticDiscipline` is an executable
**fictional league** admission gate for ONE specified club at ONE
next synthetic fixture. It uses a fully verified schema-6 journal:
no caller-provided yellow counts, prior results, referee outcomes or
carried suspensions are admitted. All previous synthetic scheduled
matches **for this club** must be present. A missing match is an error,
not a zero-card assumption. Journal insertion order cannot advance
a player's ban or declare it served.

For the exact club and round, the gate tracks:

- Uncomplicated first-yellow observations in distinct source fixtures.
  Each fourth such model event schedules a one-game modelled ban.
- A modelled second-yellow dismissal independently schedules a one-game
  modelled ban, without counting its same-fixture first caution toward
  the simple four-caution sequence.
- A ban is served only by the **next completed synthetic fixture for
  that club**, with the player omitted from starting XI **and named bench**.
  An already committed match violating that state produces
  `HISTORICAL_AUTO_BAN_CONFLICT`.
- If the current lineup or named bench contains a pending banned player,
  return `CURRENT_LINEUP_BLOCKED`; an otherwise eligible match sheet
  receives a versioned narrow-model positive report with the ban source
  fixture and reason.
- Any prior unadjudicated straight red makes the admission fail
  `UNRESOLVED_DIRECT_RED_KDK` rather than inventing a match count.
  Appeals, stays, medical fitness and all external KDK actions are
  outside this purely deterministic automatic discipline model.

**Important:** this is not a registered Russian RPL fixture, a KDK
sanction database, a validation of opponent eligibility or medical
clearance. It uses the **fictional synthetic round sequence**, which
does not establish official fixture dates, postponements or served
matches for real players. The response explicitly marks real-world
authority, opponent admission, medical fitness and calibration
`false`. It is not allowed to override the separate externally
authenticated suspension checks.

The tested sample covers four replayed independent caution fixtures
posted out of order, automatic next fixture XI+bench denial, valid
omission from match sheet, incomplete history fail-closed, historical
violations, forged data and malicious getters. Previous journal
schemas, M0 data, past engine outputs and underlying match RNG are
unchanged.

Remaining P3: authenticated or deterministic fully modelled KDK
decisions for straight reds, severe medical issues and recovery,
all six Law 5 exceptions, generated penalty-area fouls/own-goal
causality, full eleven-player and bench medical timing, true fixture
eligibility for **both** clubs and season resumption. P3 #29 is still
open and M2 is prohibited.
