# M1 P5: pinned OpenFootball 2024/25 RPL reference candidate

**19 October 2026. Concrete 240-game source obtained and inspected in GitHub
via the public repository; statistical calibration is not approved.**

## Immutable source and rights

- Source repository: https://github.com/openfootball/europe
- Publisher CC0-1.0 declaration: https://github.com/openfootball/europe/blob/master/LICENSE.md
  and its README (public-domain dataset claim).
- Source commit: `63df627f3c87ce71708f016522ea236cf74332c3`
- Path: `russia/2024-25_ru1.txt`
- Source Git blob SHA-1: `6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc`
- UTF-8 file length, with original CRLF: **19,307 bytes**.
- SHA-256 of exact fetched source bytes:
  `f315f67d49e5f2ed26bb5b2504244f36d37be958b5ccadd1755fb6b71b015dcb`
- Source read: https://openfootball.github.io/europe/russia_2024-25_ru1.html
- Immutable raw URL:
  https://raw.githubusercontent.com/openfootball/europe/63df627f3c87ce71708f016522ea236cf74332c3/russia/2024-25_ru1.txt

This dataset is **not** the absent `2024-25/ru.1.json` in the distinct
`openfootball/football.json` repository. The independent
`openfootball/europe` repository *does* contain 2024/25 RPL scores.
Do not conflate these repositories.

## Direct inspection results (fixed source)

The original plain-text content was read from the above Git commit, parsed
across all 30 matchdays, checked for exactly 8 matches per round, 16
distinct teams and 240 unique ordered home/away fixtures. Results:

| Metric | Observed |
| --- | ---: |
| Finished matches | 240 |
| Home wins | 103 |
| Draws | 65 |
| Away wins | 72 |
| 0-0 draws | 20 |
| Home goals | 364 |
| Away goals | 284 |
| Total goals | 648 |
| Teams | 16 |

All nine reported values **exactly match** the previously stored
`data/rpl-2024-25-published-aggregate-research.json`, independently
researched from the public `Чемпионат` and `Sportbox` summaries. This is
a strong aggregate-level consistency check, **not** confirmation of every
fixture against an official match protocol, statistical independence of
all underlying feeds or their complete licensing chain.

## Executable independent check

`scripts/m1-p5-openfootball-rpl.mjs` checks the exact UTF-8 hash, complete
round-robin fixture topology and score constraints and emits anonymized
aggregate metrics plus cross-check differences. It never imports team names
or match rows into a playable career and never rewrites the historic source.

Use the opt-in manual `M1 P5 pinned OpenFootball RPL observation`
GitHub Actions workflow. It downloads the immutable raw URL to a temporary
private runner directory; its summary includes only anonymized research data.
There is **no scheduled fetch**, raw match artifact, automated M1 acceptance
or production dependency on a remote football-data host.

## Remaining acceptance gates

1. Independent rights review: CC0 is explicitly declared by the repository,
   but verify relevant upstream rights/author authority as needed before
   commercial redistribution; no raw third-party records shipped now.
2. Match-by-match check against independently published primary RPL/RFU
   records, not merely matching aggregate totals. Freeze discrepancies.
3. Pre-register realistic targets and training/held-out season allocation.
   The 2024/25 season alone is **one reference season**, not an independent
   evaluation holdout after fitting on that same season.
4. Cards, shots, shots on target, xG and injuries are not part of this
   OpenFootball score file. Do **not** manufacture those metrics or interpret
   missing data as zeros. Seek separately licensed genuine sources and
   model event generation before statistical acceptance.
5. Run full-size seeded cohorts and both final repository-wide M1 audits.

P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
and exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
stay OPEN. M2 remains prohibited.
