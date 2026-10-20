# M1 P3: generated referee plus legally admitted half-time coaching (v20)

**20 October 2026. Isolated headless experiment; not full rules acceptance
and not a career-save migration.**

The v20 `src/core/m1-v20-referee-halftime-coaching.ts` contract
combines v19's seeded internal foul/card/suspected injury event
generation with **user/delegated normal half-time substitutions**.
The manager provides ordinary versioned commands only at exactly
2700 running seconds, with `stoppage: half-time`, and v17/v8 applies
the existing verified actor, team, bench, competition and substitution
constraints. The generator uses the resulting physical XI when
selecting all later eligible offence participants.

The v19 five-draw referee/medical substream (90 per match) is
unchanged by the commands, and remains separate from the five-draw
v8 open-play RNG substream. **All goals, shots, source discipline,
withdrawals and final physical XI are evaluated by one coherent
v17/v8 match.** No precomputed score from an alternative XI is
stitched into the outcome. Input commands are JSON-tree guarded and
bounded; replay verification binds the command history to the
generated sanction stream, timeline and match result.

This implements only the lawful uncontroversial half-time window;
it does **not** allow free-form user `referee-authorized` claims to
fabricate a non-goal in-play stoppage. A same-second card and
substitution cannot be ordered without a verified physical protocol,
so in-play interactive coaching is still excluded. Ordinary
half-time entries do not consume an in-play substitution opportunity.

The v19 incident probability constants are research placeholders,
**NOT calibrated injury, foul or red-card frequencies**. A generated
withdrawal is not a medical diagnosis, concussion evaluation, or
recovery schedule. No sub-minute actions, extra-time VAR, penalties,
advantage, referee authentication, artificial restart authority,
late-substitute entry or season-level suspension derivation is
implied. The returned capability flags disclose these limits.

Official rules: [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/),
[Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/)
and [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/).
Prior calibration constraints remain [free-only](M1_P5_FREE_SOURCES_DECISION.md).

M0, v3-v19, browser persistence and journal compatibility are not
changed. P3 #29, P4 #30, P5 #31 and exit #3 remain OPEN, M2 prohibited.
