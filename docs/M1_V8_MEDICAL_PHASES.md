# M1 P3: medical-aware seeded match phases (isolated schema 8)

**Status: 2026-10-16, synthetic M1 experiment, NOT acceptance or M2 gameplay.**

\`src/core/m1-v8-medical-phases.ts\` introduces a new versioned result:
engine \`7\`, event schema \`8\`. It uses existing v7 validation of original
referee special-goal decisions and team/individual commands, then replays the
phase model using the same five seeded RNG draws per phase. Ordinary
initial-starting outfield players are temporarily removed from physically
present XIs after validated \`treatment-exit\` and re-admitted only via the
limited IFAB 2026/27 medical return gate. This **changes** synthetic weighted
shooter selection, possession, defense, goals and xG only in the new result;
existing v6 and v7 outcomes, journals and M0 saves remain identical.

The new canonical event stream contains versioned availability actions,
medical exit/return facts, confirmed penalties/own goals, regenerated
open-play shots and full-time. Successful penalties and own goals are
credited once. \`verifyM1V8MedicalResult\` recomputes the full result from
original source inputs; forged shots, totals, medical actions or RNG state
fail verification. Outfield treatment combined with below-seven numbers,
temporary goalkeeper absence, absent penalty actors, substitution of an
off-field injured player and related exceptions fails closed.

**Trust and coverage boundaries:** the current clock only has 300-second
phase checkpoints. Actual medical stoppage, ball-in-play intervals,
one-minute running time after an independently confirmed restart, referee
permission and physical substitution procedure require an authenticated
referee controller; raw local JSON/IDs do not prove them. The v8-only
medical schedule supports **multiple independent actions at the same
300-second checkpoint**, processed in recorded source order before that
phase's shot. Each player's exit/return chronology and referee signal
requirements remain independently checked; wrong team, duplicate IDs,
double exit, early return and decreasing timestamps still fail closed.
Previously accepted v8 results replay identically, while the older v7
medical replay deliberately retains its strictly increasing timestamp
contract. Actions remain restricted to ordinary outfield **initial
starters**. No independently sourced KDK rulings, concussion/keeper
exceptions, minute-level matches, do-overs, referee-authenticated resumption,
true quota recovery or live gameplay are included. An isolated v8
[IndexedDB CAS prototype](M1_V8_INDEXEDDB_CAS.md) exists, but is not
production persistence acceptance.

A valid prior v7 match source is prevalidated for commands and referee
adjudications, but its previously simulated *open-play* shots are deliberately
not treated as authoritative v8 shots. They are regenerated with the same
initial seed and draws against physical presence. This is an isolated
prototype without an independently licensed football calibration baseline.

Issues #29, #30, #31 and M1 exit #3 remain open. M2 requires separate
approval.

## Shared medical action validation

The v8 replay now calls the exact strict version-1 treatment-action parser
used by the v7 presence validator. This eliminates duplicate field/clock/
referee-signal validation and helps prevent rule drift between versions.
The change does not authenticate incoming medical facts, revise existing
v6/v7 events or alter existing save formats.
