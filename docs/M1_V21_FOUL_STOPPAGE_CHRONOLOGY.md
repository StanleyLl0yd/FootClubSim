# M1 P3: virtual referee foul-stoppage chronology (v21)

**20 October 2026. Isolated versioned experiment, not complete lawful
set-piece adjudication, calibrated football or a save migration.**

v21 derives a single event chronology from the existing source-linked
[v20 in-game referee and half-time coaching](M1_V20_INTERNAL_REFEREE_HALFTIME_COACHING.md).
For each **internally generated physical foul** (reckless challenge
or serious foul play) that v20 ties to a caution or dismissal, the
new chronology emits, in strict order:

1. a `synthetic-foul-whistle` retaining the pre-sanction physical XI;
2. the exact v17 disciplinary decision event and post-sanction XI;
3. a `synthetic-foul-restart` after a bounded configurable
   stopped-wall interval (1–120 synthetic seconds).

The sanction event links to its v17 source event ID, the generated foul
decision, offending player, team, and candidate beneficiary club. Other
source events (shots, goal kickoffs, medical withdrawals, half-time
changes, full-time) retain their original order, team and player
attribution, physical XI, running seconds and v20/v17/v8 seeded
results. Wall time accrues the explicit stopped seconds **without
consuming extra running time or RNG draws**. Full-result replay
verification binds all authored outputs to prematch, policy, coaching
commands, seed and wall duration; altered evidence fails verification.

## Intentionally unresolved legal/physical details

IFAB [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/)
distinguishes direct free kicks from penalties by offence location
and circumstances. v20 currently does **not** generate a ball/pitch
location or model advantage. Consequently the award to the victim club
is **a candidate only**. A restart event means the five-minute
prototype continues synthetically: **it does not claim that a legal
DFK, indirect FK, penalty kick, advantage or dropped ball was
selected or physically taken**. The `restartLocationAndPenaltyAdjudicated`
capability is always false.

Likewise suspected non-contact injury withdrawals do not automatically
become a foul stoppage. The detailed restart/assessment/exception
procedure depends on IFAB
[Law 5](https://www.theifab.com/laws/latest/the-referee/);
diagnosis, severity, treatment, timing and authority are not simulated.

Still missing: sub-minute actual ball-in-play state, pitch position,
penalties and own-goal inclusion in this one source match, real
free-kick phase, in-play substitutions at generated stoppages,
physical entry-delay protocol, concussion/goalkeeper exceptions,
authoritative external sanctions, calibrated injury/foul rates.
Five-minute phase RNG is not a substitute for individual lawful
football restarts.

The historical v3-v20 engines, M0/browser storage and career journal
are unchanged. All M1 P3 #29, P4 #30, P5 #31 and exit #3 remain open.
M2 work is prohibited until exit acceptance.
