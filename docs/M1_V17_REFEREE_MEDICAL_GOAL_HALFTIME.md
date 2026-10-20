# M1 P3: one source-derived referee, medical and roster timeline (v17)

**20 October 2026. Isolated source-replay experiment. Not an
authenticated referee service, legal acceptance, or migration.**

`src/core/m1-v17-referee-medical-goal-halftime.ts` extends v16 with
asserted IFAB 2026/27 [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/)
cards and irreversible ordinary medical withdrawal. The accepted
`caution`, `direct-red`, `injury-withdrawal` sources and ordinary
substitutions feed exactly **one** `simulateM1V8MedicalPhases` execution.

- The source-led event stream records first yellow, second-yellow
  dismissal, direct dismissal and irreversible withdrawal. The same
  physical XI drives all later open-play shooter selection and goals.
- The same timeline still covers generated goal restarts, half-time,
  synthetic stopped-wall time and ordinary temporary treatment; every
  generated shot participant must be physically present.
- A substitution preserves a short-handed XI. The final XI, remaining
  temporarily absent players, report and RNG state all reconcile with
  the one v8 source run; tampered candidates fail replay verification.
- Mixed referee decisions and substitutions at the **same checkpoint**
  fail closed with `UNSUPPORTED_COMMAND`: no trustworthy physical
  sequence exists to order a board, card and restart in this subset.
- The `trusted-referee` / `trusted-medical` origin value is merely
  an unverified input string. Both referee and medical authority flags
  remain false. There is no autonomous foul/card/injury generation.

The model remains a five-minute phase experiment. It does not verify
actual whistle timing, Law 12 offence evidence, scorer-side VAR
decisions, penalty/own-goal interactions in this adapter, actual
referee identity, goalkeeper/concussion exceptions, delayed
late-substitute entry or stoppages other than internally generated
goals and halftime. An action claimed at an arbitrary phase is
**not** evidence that play really stopped; its physical effects are
shown solely as source assertions.

No v3-v8, v15-v16, M0, browser save or career schema is modified.
P3 #29, P4 #30, P5 #31 and exit #3 remain open; no claim is made that
M1 is complete. Full two-pass repository-wide audit is still pending.
M2 is prohibited.
