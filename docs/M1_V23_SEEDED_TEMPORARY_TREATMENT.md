# M1 P3: seeded temporary treatment / verified physical XI (v23)

**20 October 2026. Isolated headless research; NOT authenticated treatment,
NOT an IFAB complete medical protocol, NOT calibrated to RPL injury rates.**

v23 adds a second, independently seeded and domain-separated synthetic
medical substream to the v22 internal referee/manager chronology. Exactly
**three treatment RNG draws per five-minute phase** (54 per match) are
consumed regardless of whether an assessment is generated. The
existing referee RNG sequence remains exactly five draws per phase
(90 per match), and v8 uses its own preserved 90 open-play draws.

Only a player present and eligible at a **self-generated foul whistle**
may be selected for a hypothetical ordinary off-field assessment.
This research subset excludes goalkeepers, players who were not among
the starting XI, overlap with prior treatments, half-time exception
timings, and departure below seven physically available players.
Eligible non-keeper medical exits become actual v8 `treatment-exit`
actions *before that foul's synthetic restart*. The same player may
return at the next 300-second checkpoint, well beyond the narrow
60-running-second post-restart minimum, via a labelled **unverified**
referee signal and touchline entry. A foul at 2400 is not used for
temporary exit because its proposed return would occur at half-time,
which needs a separate first-half/half-time exception. An exit too
late to return by a following checkpoint is also excluded.

The new source chronology `m1-v23-referee-treatment-source.ts`
delays synthetic foul restart emission until all same-checkpoint
medical events have been processed. This prevents a fake timeline
in which injured players leave **after** the referee has already
restarted. Coach substitutions, cards and medical exits/returns
therefore use one v8-calculated physically present XI for every
subsequent seeded shot. The authoritative score is calculated once
and never stitched from independent games.

**No real-world authority claims:** medical-staff attendance, actual
referee signals, injury observations, ball-in-play/off-play state,
diagnoses and recovery information are not witnessed or authenticated.
The `refereeSignalId` is an internal synthetic placeholder; it is NOT
a trusted signature. The injury occurrence threshold **0.28
conditional on selected generated fouls** is an engineering stress
probability, not an empirical medical exposure/incidence measure.
Capability fields expose `externalMedicalAuthorityAuthenticated:false`,
`injuryDiagnosisAndRecoverySupported:false`,
`syntheticFoulRatesCalibrated:false` and
`halfTimeMedicalExceptionSupported:false`. Synthetic timing remains
five-minute coarse, not second-level IFAB chronology.

Official narrow constraints: [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/),
[Law 5](https://www.theifab.com/laws/latest/the-referee/),
and [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/).
The verified P3
[limited return admission](../src/core/m1-medical-return.ts) is reused
as the only legal preflight for ordinary outfield returns; exceptions
are excluded. No M0, v3–v22, browser, journal or persisted career
schema changes. P3 #29, P4 #30, P5 #31 and exit #3 stay OPEN.
M2 remains prohibited. Full two-pass audit has not been executed.
