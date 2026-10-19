# M1-P5 two-season empirical scores research: 2023/24 correction

**19 October 2026. Evidence-backed primary-source discrepancy, not
full external calibration, source-license audit or approved M1 exit.**

## Immutable source, discovered discrepancy and official correction

The **OpenFootball/europe** repository at immutable commit
`63df627f3c87ce71708f016522ea236cf74332c3` includes two adjacent
seasons of Russian Premier League results:
- `russia/2023-24_ru1.txt`: original 19,265 UTF-8 bytes; Git blob
  `3ea6829a971d1cbdf56552be0519cc125707bd99`;
  exact raw SHA-256 `18512df8829a945f2b543a8ed5e8c3259e216263bc3e2a35c5545421d27b59cc`.
- `russia/2024-25_ru1.txt`: prior independently inspected 240-game
  reference, exact source SHA-256 in [2024/25 report](M1_P5_OPENFOOTBALL_2024_25.md).

The 2023/24 source contains a verifiable **home/away transposition**:
- **Round 8, Saturday 16 September 2023**: OpenFootball lists
  `FK Sochi v Spartak Moskva 0-1 (0-0)`.
- **Round 24, Saturday 13 April 2024**: OpenFootball also lists
  `FK Sochi v Spartak Moskva 1-0 (0-0)`.
- The **Russian Football Union competition calendar**
  [rfs.ru/tournament/1434/calendar](https://www.rfs.ru/tournament/1434/calendar?round_id=18568)
  explicitly confirms **Spartak Moscow 1:0 Sochi** on 16 September.
- [FC Sochi's contemporaneous official notice dated 7 September 2023](https://pfcsochi.ru/news/2023-2024/rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-sochi-i-spartakom/)
  confirms an RFU/RPL-approved swap of the nominal home venues: the September
  match became Spartak's home, and the second-leg match became Sochi's home.
- The [2023/24 English Wikipedia results matrix](https://en.wikipedia.org/wiki/2023%E2%80%9324_Russian_Premier_League#Results)
  and [Чемпионат published season summary](https://www.championat.ru/football/_russiapl/tournament/5441/)
  agree with the official correction.

Before correction, the 240-row source has **two directed Sochi-Spartak
pairings** and no reverse Spartak-Sochi pairing. It falsely reports
112 home wins, 66 draws, 62 away wins, 358 home goals, 279 away goals;
total goals remain 637, disguising the error in season-only sums.

After the **single known evidence-bound correction**, the 16-team,
30-round, 240-match directed double-round-robin has no missing or repeated
pairings. It matches the published season counts:

| Statistic | Corrected 2023/24 |
| --- | ---: |
| Home wins / draws / away wins | 113 / 66 / 61 |
| 0:0 | 20 |
| Home / away goals | 359 / 278 |
| Total goals | 637 |
| Matches, teams | 240, 16 |

## Implementation safeguards

`scripts/m1-p5-openfootball-2023-24.mjs` requires the exact source
SHA-256 and source size **before** interpreting its content. A single
fixed-string repair is allowed only inside matchday 8 after the 16 September
date marker and before matchday 9. The original file bytes remain unchanged.
The transient corrected view runs the SAME bounded 30-round/16-team
double-round-robin parser as 2024/25 and must match the independent published
aggregate totals exactly. No season rows are redistributed or stored.

The strictly **manual** workflow
`.github/workflows/m1-p5-openfootball-2023-24.yml` only emits
an anonymized report from private-runner temporary files. It has not been
dispatched. No production match database, personnel pack, game score or
save schema changes are introduced.

## Prospective experiment separation

**Proposed before any model tuning**: use **2023/24 as the development
reference**, corrected transparently, and reserve **2024/25 as the untouched
held-out season**. This does not guarantee source independence or statistical
power, and the 2024/25 data were already inspected for research.
The final metrics, admissible error bands and uncertainty policy must be
registered before tuning, then only the **2023/24** distribution can inform
parameters; the **2024/25** holdout must not be inspected for optimizing
decisions. No matching of simulated scores to desired outcomes is permitted.

A declared CC0 license in OpenFootball is not proof of all upstream rights.
No approved reference yet exists for shots/on-target, xG, cards or injuries;
do not treat their absence as measured zero. P5 [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31)
and M1 exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
remain OPEN. M2 remains forbidden.
