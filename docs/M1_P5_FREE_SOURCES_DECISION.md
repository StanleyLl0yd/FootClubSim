# M1 P5 - decision: free sources only

**Owner decision: 19 October 2026.** Use free and legally assessable
football references. No commercial data-service subscription, paid data
feed, premium API, scraping around access challenges or redistribution of
uncleared third-party records. This is a source-selection decision, **not**
a finding that M1 P5 has passed.

The accompanying machine-readable source registry is
[`data/m1-p5-free-source-policy.json`](../data/m1-p5-free-source-policy.json).
The local no-network verifier
[`scripts/m1-p5-free-source-gate.mjs`](../scripts/m1-p5-free-source-gate.mjs)
enforces **0 RUB paid data spending**, closed and bounded source metadata,
the original owner-selected development/holdout separation and **no
automatic production acceptance**. Run:

`node scripts/m1-p5-free-source-gate.mjs`

Unit tests reject source role escalation, unverified rights promoted to
approved, fake RPL labels on older European matches, forged xG availability,
paid-source budget, tampering with holdout, duplicate entries and malicious
JSON. These checks prove policy structure only; they do **not** authenticate
external provider licenses or measure football realism.

## Ranked research sources

| Priority | Source and rights evidence | Actual role | Boundary |
| --- | --- | --- | --- |
| 1 | [OpenFootball/europe fixed source](https://github.com/openfootball/europe), publisher declares CC0-1.0 | Complete 2023/24 RPL score **development** (one independently evidenced home-team repair); 2024/25 **reserved holdout** | Publisher CC0 does not certify every upstream contributor's rights. 2024/25 previously inspected and not statistically blinded; never tune against it. |
| 2 | [Pappalardo and Massucco original Events](https://figshare.com/articles/dataset/Events/7770599), Figshare CC BY 4.0 | Open European 2017/18 football-shot/foul/event **mechanics research** | No RPL 2023/24 or 2024/25 matches, no ready-made RPL medical/xG reference. Keep source attribution. |
| 3 | [Bassek et al. DFL-authorized 2022/23 data](https://doi.org/10.6084/m9.figshare.28196177), original Figshare CC BY with DFL authorization confirmed by the [peer-reviewed publication](https://www.nature.com/articles/s41597-025-04505-y) | **Seven** German elite football matches with event/tracking data and reported xG to check **shot/xG mechanics** | Only two matches are first-division Bundesliga and five second-division; 7 is far too small to calibrate a full RPL season. 2.45 GB of raw data is not imported into the game. |
| 4 | [SoccerMon dataset](https://doi.org/10.5281/zenodo.10033832), CC BY in the [Scientific Data publication](https://www.nature.com/articles/s41597-024-03386-x) | Injury, fitness and monitoring **methodology research** | Two female elite teams; sensitive individual monitoring histories, different population and exposure. No direct male RPL match-injury frequency. No person-level re-publication or silent ingestion. |
| 5 | [RPL 2024/25 official technical-report listing](https://premierliga.ru/about/documents/) | Manually confirm metric definitions/public headline aggregates, **subject to terms** | Document existed on listing dated 16 July 2025, but original PDF bytes, metric contents and redistribution authorization were not authenticated. No CAPTCHA bypass. |
| 6 | [footbolno.ru advertised open statistics](https://footbolno.ru/otkrytye-dannye) | Rights/coverage assessment only | Publisher CC BY declaration does not resolve upstream third-party database licensing or exact immutable event snapshot; claimed schema does not have xG/shots/injuries. |
| blocked | [Transformed Wyscout repack](https://github.com/koenvo/wyscout-soccer-match-event-dataset) and [StatsBomb open data](https://github.com/statsbomb/open-data) | Source metadata research only | Derivative-specific rights or suitability for redistribution by a proprietary game not independently established. No automatic production import. |

Primary original Pappalardo source includes shot and foul events,
rather than xG estimates for a Russian season. The DFL dataset is a
**separate original authorized open source** with per-shot xG information,
not a license for the third-party Wyscout repack. The SoccerMon study
reports 306 injury forms, but those are not comparable football
matchday injuries without a defined risk denominator.

## P3 / P5 division of responsibilities

- **P3 first:** Build a deterministic **virtual in-game referee** that
  generates legal whistles, foul decisions, card/penalty/own-goal events,
  timings, physically present players, substitutions and injury responses.
  Its in-game authority is rule-governed state and auditable seeded replay,
  **not** a real RFU referee's Ed25519 signature. External signature proof
  remains relevant only when someone imports external claims.
- **P5 baseline:** Score outcomes may be compared *descriptively* against
  the corrected RPL 2023/24 season; preserve full original bytes/hash.
  Research-only cross-league event data may inform feature meanings,
  algorithm choices and deterministic event classification, **not**
  automatically RPL probabilities.
- **P5 acceptance:** For goals, home/away, draws, shots, shots on target,
  xG, cards and injuries, each field must report its source, actual cohort,
  covered event class, license/terms, sample size, uncertainty and
  explicitly pre-registered tolerance. An absent measure is
  **UNAVAILABLE**, never zero. No independent licensed RPL source means
  an honestly labelled **NOT_CALIBRATED** state, not a fabricated PASS.
- **Holdout:** 2023/24 development, 2024/25 reserved check. The target
  season has previously been read by researchers; do not pretend it was
  double-blind. Freeze the model and numerical thresholds *before*
  invoking the final holdout evaluation; no repeated optimization against
  it.
- **Release:** Game source remains proprietary. CC BY original research
  materials must be attributed if used under their stated conditions.
  Published match statistics cannot be assumed freely redistributable.
  Buying licenses is NOT part of the approved M1 workstream.

This policy does not relax [P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
[P5 #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
or [M1 exit #3](https://github.com/StanleyLl0yd/FootClubSim/issues/3).
M2 remains forbidden.
