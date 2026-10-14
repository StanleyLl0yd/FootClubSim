# Secondary RFU Cup team indexes for all 16 «Лига приколов» prototypes

**Research:** 2026-10-14. **Result:** all 16 club-name/city references in the [RFU's 2026/27 Cup of Russia RPL-path directory](https://www.rfs.ru/cup/teams) were independently followed to matching RFU **Cup team index pages**, with exact URL/club ID bindings archived [as link-only JSON](../data/drafts/liga-rfs-cup-team-index-links-2026-10-14.json).

This removes a **source-discovery gap**, not a date-qualified registration or rights gap. These links are **not** proof that a person shown on any page is registered for the RPL on 2026-10-14 or that its player table may be copied, scraped or redistributed. No squad counts or list bodies are stored for the other 15 clubs.

## Verified link correspondence

| Fictional club | RFU official Cup team index |
| --- | --- |
| `lp-nadir` | [Зенит, Санкт-Петербург](https://www.rfs.ru/cup/teams/26) |
| `lp-zelenober` | [Краснодар, Краснодар](https://www.rfs.ru/cup/teams/367) |
| `lp-vagon` | [Локомотив, Москва](https://www.rfs.ru/cup/teams/20) |
| `lp-patriciy` | [Спартак, Москва](https://www.rfs.ru/cup/teams/33) |
| `lp-ogkm` | [ЦСКА, Москва](https://www.rfs.ru/cup/teams/25) |
| `lp-pacifica` | [Балтика, Калининград](https://www.rfs.ru/cup/teams/83) |
| `lp-statika-m1` | [Динамо, Москва](https://www.rfs.ru/cup/teams/35) |
| `lp-izumrud` | [Рубин, Казань](https://www.rfs.ru/cup/teams/29) |
| `lp-uprek` | [Ахмат, Грозный](https://www.rfs.ru/cup/teams/37) |
| `lp-spadov` | [Ростов, Ростов-на-Дону](https://www.rfs.ru/cup/teams/38) |
| `lp-korni-zapretov` | [Крылья Советов, Самара](https://www.rfs.ru/cup/teams/118) |
| `lp-orendorf` | [Оренбург, Оренбург](https://www.rfs.ru/cup/teams/717) |
| `lp-nizon` | [Акрон, Тольятти](https://www.rfs.ru/cup/teams/3635) |
| `lp-statika-m2` | [Динамо Мх, Махачкала](https://www.rfs.ru/cup/teams/3637) |
| `lp-chuzhbina` | [Родина, Москва](https://www.rfs.ru/cup/teams/3636) |
| `lp-ognetushitel` | [Факел, Воронеж](https://www.rfs.ru/cup/teams/292) |

Club identity is resolved using the **combination of the RFU directory's RPL-path classification, team name and city**, not only an ambiguous name (notably the two «Динамо» teams). The separately [versioned Wikidata QID mapping](../data/drafts/liga-wikidata-club-map-v1.json) remains independent of these RFU pointers.

## Source interpretation and legal boundaries

- RFU 2026/27 Cup directory offers one official alternative to the previously registered 16 club websites. The RFU team pages are **dynamic**, not frozen `2026-10-14` historical snapshots, and represent a **Cup** competition rather than a confirmed **RPL** registration list.
- [«Надир» counterexample](NADIR_RFS_CUP_CROSSCHECK.md): the RFU index still includes three players who have separately announced August/September transfers/loans. This is direct evidence that *simply counting index rows produces false current-roster classifications*.
- Indexes may contain unused cup registrations, academy players, old transfers, differently defined positions and eligible players never fielded. A `0` appearances count cannot be interpreted as absent, inactive, ineligible or never registered.
- Official page presence is not third-party reuse permission. **No full player table, league dataset, portraits, real crests or provider ratings copied.** Need explicit rights/legal assessment before any bulk ingestion or public playable pack. Even individual public facts need accurate provenance and effective-date review.

**Next:** combine the 16 link pointers with date-stamped **registration reports and match protocols**, then reconcile loans/departures one club at a time (starting with «Надир», then «Зеленобер»). Only then can a denominator and credible field coverage be measured. Staff and coaching require independent dated sources. Relevant gates: [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15), [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).

**State remains: 16/16 official Cup source links discovered, 0/16 as-of RPL rosters verified, 0 factual player records licensed or placed into playable packs, M0 open.**
