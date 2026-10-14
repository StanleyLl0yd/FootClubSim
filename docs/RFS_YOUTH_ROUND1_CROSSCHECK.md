# RFU first-round under-20 appearance summary (historical source cross-check)

**Reviewed:** 2026-10-14. The [official RFU article published 6 August 2026](https://www.rfs.ru/news/224801) reports **21 footballers under 20** who appeared in the 4-5 August first round of the 2026/27 Cup RPL path, and identifies **10 of the 16** participating clubs as having such appearances. This is a dated *post-match youth participation summary*, **not** a signed RPL registration list. The separately verified [eight Cup fixture pointers](RFS_CUP_ROUND1_SOURCE_COVERAGE.md) cover all 16 clubs.

## Independently summarized counts

The source's ten positive club mentions map to approved immutable fictional club IDs as follows:

| Fictional club ID | Reported players under 20 who appeared |
| --- | ---: |
| `lp-nizon` (Акрон) | 3 |
| `lp-pacifica` (Балтика) | 2 |
| `lp-statika-m1` (Динамо Москва) | 2 |
| `lp-nadir` (Зенит) | 1 |
| `lp-zelenober` (Краснодар) | 2 |
| `lp-vagon` (Локомотив) | 2 |
| `lp-orendorf` (Оренбург) | 2 |
| `lp-spadov` (Ростов) | 3 |
| `lp-patriciy` (Спартак) | 3 |
| `lp-ogkm` (ЦСКА) | 1 |
| **10 clubs / 21 appearances by distinct named young players** | **21** |

**The other six clubs were not named in this youth-only article.** Record this as *not mentioned*, **not** as a verified zero of young players, a zero youth registration count or an empty first-team squad. The ages are those *reported for the August event*, not independently established birth dates or October ages. A summary of positive appearances does not cover absent, injured, unused, over-20 or unregistered persons.

## One deliberately narrow «Надир» source corroboration

The article names **Даниил Кондаков** as the one Zenit under-20 participant and credits him with an assist against Baltika. The independent [RFU 5 August Zenit - Baltika completed match protocol](https://www.rfs.ru/cup/tournament/match/57198) lists Kondakov in the **starting XI** and includes the assist attribution on the recorded goal. The approved *fictional identity draft* is `lp-person-0019` (Даниил Кондачков). This is only a research identity/prototype pointer: it **does not** establish a registered RPL squad member on 14 October, a lawful data-reuse basis, full date of birth, contract continuity or future squad availability.

The same August match protocol still lists Юрий Горшков for Zenit. A separately recorded [15 August transfer account](NADIR_RFS_CUP_CROSSCHECK.md) later reports him at Krylya Sovetov. Therefore even a correctly dated *completed* match can prove only historical participation, not future affiliation. Do not join August and October records into a single undated "currently registered" state.

## Machine-readable research and release guard

[`liga-rfs-youth-round1-summary-2026-10-14.json`](../data/drafts/liga-rfs-youth-round1-summary-2026-10-14.json) keeps only club-level aggregate counts, the one targeted corroboration, precise official source references and explicit **zero verified October registrations / zero licensed playable imported facts**. [Contract and negative tests](../tests/rfs-youth-round1-summary.test.mjs) enforce the positive counts, dates, source identity, 16-club mapping, individual fixture reference, no copied lineups and the distinction between "not mentioned" and "zero".

No third-party player index, article, full lineup, crest or photograph was copied into the playable data pack. Public source access alone supplies neither a database redistribution license nor permission for image/likeness usage. The M0 synthetic catalog, original `lp-person-0019` identity and career saves are unchanged.

**Remaining:** find a date-frozen authoritative 2026-10-14 RPL/RFU registration denominator, reconcile loans and transfers per person, verify staff separately and clear lawful collection/reuse rights. **0/16 complete as-of RPL registrations** remain verified. See [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15) and [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).
