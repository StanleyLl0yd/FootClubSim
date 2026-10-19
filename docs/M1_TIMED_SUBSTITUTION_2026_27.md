# M1-P3 IFAB 2026/27: narrowly verified departure-time boundary

**19 October 2026. Research-only pure rule check; not a lawful completed
substitution, referee authentication or match-clock implementation.**
No existing M0 or M1 save/journal/event schema was changed.

## Normative references

- [IFAB 2026/27 Law 3.3](https://www.theifab.com/laws/latest/the-players/):
  generally the outgoing player must leave the field within **ten seconds**
  of the board/signal; the entering substitute needs a stoppage, correct
  halfway-line entry, the outgoing player already off, and referee signal.
- [IFAB Time-limited substitution protocol](https://www.theifab.com/laws/latest/time-limited-substitution-protocol/):
  a referee-determined late departure ordinarily restarts play without the
  substitute; substitute may enter at the **first stoppage after at least
  60 seconds of running play following restart**, subject to referee signal.
  A delayed change cannot be cancelled or exchanged for another substitute.
- The referee can waive the ten-second requirement for injury/safety
  and may permit entry if a player is already very near or crossing the
  boundary. Caution for delay is **not automatic**.
- IFAB 2026/27 Law 3.1 also specifically excludes some time-limited
  substitution and off-field treatment periods from the usual minimum-seven
  calculation. Do **not** turn such a temporary shortage into an automatic
  forfeit or corrupt older referee/medical models.
- [RFU 2026/27 official Russian translation notice](https://www.rfs.ru/news/224570)
  corroborates the new ten-second and one-minute provisions.

## Implemented narrow conditional validator

`src/core/m1-timed-substitution-protocol.ts` independently returns
`WITHIN_TEN_SECONDS` only for a single reported departure with exit time
at most signal+10 wall-clock seconds. Above ten seconds it returns
`REFEREE_REVIEW_REQUIRED` and a **conditional** 60-second running-clock
threshold. This is **not** entry eligibility or automatic punishment:
referee proximity, safety and injury exceptions require a trusted ruling.

The input includes an externally supplied referee-signal ID, but that ID is
**not a signature** and cannot authenticate itself. The pure function checks
bounded exact JSON fields, real-time vs running-time domains, fixture/team
identity, and names on the original match sheet. Multi-player substitutions
remain rejected by this schema-1 function as `GROUPED_RULING_REQUIRED`.
A separate [schema-2 grouped observer](M1_GROUPED_SUBSTITUTION_2026_27.md)
checks the IFAB last-board/signal deadline; neither module authorizes
a physical replacement. Another current-state
validator must confirm the outgoing player really remains on-field, incoming
bench unused, legal stoppage, normal replacement limits, correct entry and
the independent authenticated referee signal before changing the active XI.

No random event generator, arbitrary 300-second checkpoint, save fragment,
frontend button or self-asserted `referee-authorized` JSON may turn this
conditional observation into a completed physical change. A proper v9+
state machine needs explicit physical departures, absent/awaiting substitutes,
running clock, referee stoppage evidence and restoration after legal entry.

## Completion blockers remain

- Authenticity and completeness of referee/medical/KDK decision sources.
- Full timed substitutions, multi-sub groups and special medical exceptions.
- 2026/27 RPL and IFAB rules reconciliation in new integrated engine.
- P5 independent legally reusable match statistics and the two M1 audits.

Keep [P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29)
and [M1 exit #3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
OPEN. M2 remains prohibited.
