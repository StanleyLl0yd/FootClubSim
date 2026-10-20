# M1 P3: first internal deterministic virtual-referee experiment (v18)

**20 October 2026. Isolated headless research, NOT accepted football realism,
NOT a final IFAB referee model and NOT an M0/M1 save migration.**

`src/core/m1-v18-internal-referee.ts` introduces the first bounded
**internally generated** (rather than caller-supplied) foul/caution/direct-red
decisions. Each simulated offence is linked to the resultant v17
disciplinary event and its physical-XI snapshot.

## Contract

1. The caller supplies only the validated prematch and policy.
   **No free-form referee event, claimed signature or trusted origin string**
   can be passed to this entrypoint. Internal commands carry the legacy
   `trusted-referee` discriminator solely to reuse v17's existing
   *admission format*: it is **not** an externally authenticated signature.
2. A versioned xorshift32 referee substream is domain-separated from v8's
   existing five shot RNG draws per checkpoint. Exactly **4 referee draws
   per phase**, or **72 per 90-minute match**, are consumed even when no
   foul occurs. A changed sanction must change later physically eligible
   shot selection through a **single** v17/v8 source match replay, not by
   merging scores from different XI simulations.
3. At most one internally simulated offender per eligible five-minute
   checkpoint, never before kickoff or at the half-time boundary.
   Only registered, physically active ordinary outfield players can be
   selected; red / second-yellow removals change the physical XI.
   The simulator refuses to generate a dismissal that would leave
   fewer than seven players. Unimplemented goalkeeper scenarios are not
   silently enabled.
4. The model distinguishes synthetic `reckless-challenge` leading to
   caution and `serious-foul-play` leading to direct dismissal.
   The generated foul carries the source-generated incident ID, decision
   ID, fixture/player/team/second and matching v17 event ID. Whole-result
   verification replays the original inputs; inserted/tampered events,
   RNG metadata or scores are rejected.
5. Inputs are fail-closed against non-plain JSON, getter/cycle attacks,
   invalid prematch state and bad policies. Old v3-v8/v15-v17, career
   persistence and M0 shipping boundaries are unchanged.

## Research-only probabilities

The fixed per-checkpoint incident trigger **0.20** and direct-red split
**0.06 conditional on a generated incident** are engineering test
constants, **not RPL, IFAB or cross-league empirical estimates**.
There is no pitch-location foul adjudication, VAR, advantage, actual
whistle/restart mechanics, ordinary medical injury generation,
penalty/own-goal generation, manager coaching, late-entry replacement
protocol, stoppage-time accounting or live interactive control.
Five-minute phase aggregation cannot represent sub-minute offences.
The temporary lack of true source statistics is not hidden by an
invented calibration PASS.

The v18 result exposes `syntheticFoulRatesCalibrated: false`,
`externalRefereeAuthorityAuthenticated: false` and
`specialGoalsAndInjuriesGenerated: false`. The nested v17 source
will also retain its original external-authority limitation flags,
without falsely claiming external RFU referee authentication.

Law basis: [IFAB Law 3](https://www.theifab.com/laws/latest/the-players/),
[Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/)
and [Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/).
These identify eligible player dismissal and sanction categories, not
probabilities.

M1 P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
P4 [#30](https://github.com/StanleyLl0yd/FootClubSim/issues/30),
P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
and exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
remain OPEN. No M2 work is permitted before M1 acceptance and the
mandatory two-pass repository-wide audit.
