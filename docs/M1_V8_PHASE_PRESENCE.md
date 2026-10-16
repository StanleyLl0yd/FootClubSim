# M1 P4: v8 synthetic phase physical participation

**2026-10-16, experimental replay projection, not M1 acceptance.**

`src/core/m1-v8-phase-presence.ts` is a standalone schema-1,
read-only projection for the medical-aware match engine 7/event schema 8.
It first verifies the complete candidate match by deterministic replay from
the separately trusted prematch, policy, coach/referee commands and medical
claims. It then derives each player's:

- `registeredPhaseSeconds`: seconds legally listed as active XI,
  including temporary physical treatment absences;
- `physicalPhaseSeconds`: seconds physically present at synthetic
  300-second phase checkpoints, eligible for sampled open-play actions;
- `temporarilyAbsentPhaseSeconds`: registered seconds physically off-field
  because of treatment, distinct from substitutions, dismissals and confirmed
  medical withdrawals.

At every checkpoint, event-order changes to substitutions, discipline and
temporary medical presence are applied **before** counting the next phase.
Team reports provide total registered/physical/absent person-seconds and
minimum/maximum numbers physically present. Accounting enforces
`registered = physical + temporarilyAbsent` and reconciles the final XI
and off-field set against the authenticated-by-replay v8 result.

**Scope limits:** phase seconds are approximate **synthetic virtual clock
intervals**, not real continuous ball-in-play, athlete physical load,
fitness reduction, medical recovery, fatigued conditions or match
time-of-possession. The full medical protocol, confirmed referee source,
exceptional injuries, disciplinary appeals and real source intervals are
not modeled. No fatigue or condition delta is posted to a career.
This report is neither a statutory match sheet nor a player fitness model.

M0/v3-v7 saves, historical result journals, existing v8 match event schema
and synthetic roster sources remain unchanged. P3 #29, P4 #30, P5 #31 and
M1 exit #3 remain open; M2 requires separate owner approval.
