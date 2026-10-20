# M1 P3: internally generated disciplinary events and non-diagnostic injuries (v19)

**20 October 2026. Isolated seeded research subset. NOT calibrated,
NOT an authenticated real-world medical report, NOT final M1 acceptance.**

The `src/core/m1-v19-internal-foul-injury.ts` entrypoint builds on
v18's internally generated offences and cards and adds independently
generated **suspected injury withdrawals** to the *same* v17/v8 source
replay. No manually fabricated referee or medical command can be
submitted through this API.

The referee/medical-events substream is explicitly separated from
v8's five-open-play-draw stream. Its five draws per phase (**90 draws
per full match**) are consumed even if no synthetic incident occurs.
A seeded incident is either a generated foul leading to a caution
or red card, or a separately generated non-contact suspected injury
requiring irreversible ordinary withdrawal in this limited model.
These events can change the subsequent eligible physical XI;
the match score, open-play shooter selection, full-time physical
lineups and PRNG metadata are *all* produced by one consistent v17/v8
source match. Events link to their v17 source IDs and are checked
against full re-derived replay evidence.

The synthetic per-checkpoint **foul trigger 0.20** and **suspected
injury trigger 0.03 when no foul is generated**, with direct-red
severity split 0.06, are strictly development constants and not
observed RPL, IFAB, Bundesliga or medical incidence rates. The
team is never reduced below seven by autonomous synthetic
withdrawal. No goalkeeper exceptional ruling is claimed. Simulated
injury withdrawal is **not** a diagnosis, medical examination,
recovery prognosis, concussion protocol or actual staff authorization.

Limits remain: five-minute phases; no advantage, foul location,
set-piece/penalty/own-goal generation, VAR, real stoppage scheduling,
physical departure delays, caretaker substitutions, medical return
from synthetic injury, external referee signature or real injury
exposure denominator. True per-second causal officiating remains P3
work. Returned `injuryDiagnosisAndRecoverySupported: false`,
`externalRefereeAuthorityAuthenticated: false` and
`syntheticFoulRatesCalibrated: false` are mandatory disclosures.

Official applicable reference: [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/),
[Law 5](https://www.theifab.com/laws/latest/the-referee/),
[Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/).
These laws provide procedural constraints, never synthetic incidence
probabilities. [Free-only calibration policy](M1_P5_FREE_SOURCES_DECISION.md)
remains unchanged and supplies no validated injury rate.

Existing M0, v3-v18, persistent journal/career schemas and game
user interface are unchanged. P3 #29, P4 #30, P5 #31 and exit #3 stay
OPEN; M2 remains forbidden. No repository-wide exit audit is claimed.
