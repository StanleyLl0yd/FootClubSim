# M1 P3: complete timing evidence coverage before v8 substitutions

Source: [IFAB Law 3, Laws of the Game 2026/27](https://theifab.com/laws/latest/the-players/)
and [Time-limited substitution protocol](https://theifab.com/laws/latest/time-limited-substitution-protocol/).
RPL ordinary substitution ceilings and half-time exceptions: [RPL 2026/27 rules](RPL_2026_27_RULES.md).

This **new, optional and isolated v8 entrypoint** binds each in-play
`substitute-normal` command at an existing 300-second M1 checkpoint to
one exact schema-1 single-player or schema-2 grouped ten-second timing
observation. It refuses incomplete, duplicate, misordered, wrong-player
and late evidence before running the **same unchanged v8 calculator**.

For each team and checkpoint:
- Exactly one evidence bundle, with matching home/away, fixture, game restart
  checkpoint and ordered incoming/outgoing players;
- If there are two or more substitutions at that checkpoint, a **group**
  using the final board/signal must cover every participant;
- Any player departing after ten seconds results in a typed
  `LATE_REQUIRES_REFEREE_RULING`, **not** an invented penalty or completed
  substitute entry;
- Half-time substitutions remain unsupported in this adapter because
  the physical whistle/entry protocol differs; old v8 remains unchanged.

No type or format of saved source journal is changed. The result
`REPORTED_TIMING_BOUND_NOT_REFEREE_AUTHENTICATED` explicitly declares
`physicalStoppageAuthenticated:false` and
`refereeAuthorityAuthenticated:false`: client-supplied wall times,
`refereeSignalId`, `stoppageId` and strings cannot prove real events.
Further **virtual in-game referee control** must issue and replay these
signals within the engine, then apply replacement eligibility against the
live XI, normal 5 substitutions/3 opportunities, concussion exceptions,
physical playing clocks, medical actions, referee waivers, and live
stoppages. No AI/third-party real-world referee certificate is necessary
for *fictional in-game* decisions; external imported real match reports,
if ever accepted, need an independently trusted source.

This new research-only engine subset is not wired to the production
player UI or journal. P3 #29 remains OPEN. M0 and historical v3-v8
journal/save semantics are intact. M2 is not authorized.
