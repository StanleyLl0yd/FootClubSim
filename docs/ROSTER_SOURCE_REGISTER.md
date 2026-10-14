# 2026/27 squad source discovery register (not a playable data pack)

**Research date / intended snapshot:** 2026-10-14. The candidate primary-source URLs and their status are in [`data/drafts/liga-roster-sources.json`](../data/drafts/liga-roster-sources.json). This document lists **source locations only**, not the bulk content of third-party player/staff databases, and does not authorize automated scraping, database redistribution or protected image use. See [source/rights rules](DATA_SOURCES.md), [roster pack contract](ROSTER_PACK_DESIGN.md) and [M2 backlog #91](https://github.com/StanleyLl0yd/FootClubSim/issues/91).

## Primary-source discovery

| Fictional club | Real club inspiration | Source reference | Discovery result |
| --- | --- | --- | --- |
| lp-nadir | Зенит | [Club website](https://fc-zenit.ru/) | public-squad-url-unconfirmed |
| lp-zelenober | Краснодар | [Club website](https://www.fckrasnodar.ru/team/squad/) | current-page-unfrozen |
| lp-vagon | Локомотив | [Club website](https://www.fclm.ru/players/) | current-page-unfrozen |
| lp-patriciy | Спартак | [Club website](https://spartak.com/teams/94974f94-27da-4350-81b3-9eb7afa82237) | current-page-unfrozen |
| lp-ogkm | ЦСКА | [Club website](https://pfc-cska.com/ru/komanda/osnovnoj-sostav/) | current-page-unfrozen |
| lp-pacifica | Балтика | [Club website](https://fc-baltika.ru/team/) | current-page-unfrozen |
| lp-statika-m1 | Динамо Москва | [Club website](https://fcdynamo.ru/teams/dynamo/2026-2027/players/) | season-page-not-snapshot |
| lp-izumrud | Рубин | [Club website](https://www.rubin-kazan.ru/teams/?team=rubin) | current-page-unfrozen |
| lp-uprek | Ахмат | [Club website](https://fc-akhmat.ru/team/main/) | current-page-unfrozen |
| lp-spadov | Ростов | [Club website](https://fc-rostov.ru/team/players) | current-page-unfrozen |
| lp-korni-zapretov | Крылья Советов | [Club website](https://pfcks.ru/team/main-team/) | current-page-unfrozen |
| lp-orendorf | Оренбург | [Club website](https://fcorenburg.ru/team/osnovnoj-sostav/plays.html) | current-page-unfrozen |
| lp-nizon | Акрон | [Club website](https://fcakron.ru/team/) | empty-page-use-dated-match-protocols |
| lp-statika-m2 | Динамо Махачкала | [Club website](https://dinamo-mx.ru/list/osnovnoj-sostav-dinamo-mahachkala/) | current-page-unfrozen |
| lp-chuzhbina | Родина | [Club website](https://rodina.moscow/team/team/squad) | current-page-unfrozen |
| lp-ognetushitel | Факел | [Club website](https://fakelfc.ru/team) | current-page-unfrozen |

Finding a club's current team page is **not the same as proving a historical roster effective on 2026-10-14**. Team pages can change during the season. Validate transfers/loans and registration against **dated** club announcements and official match protocols effective on the target date. Staff/ownership require separate source evidence, including changes in October. Pages for academies, reserve teams, women's squads and hockey/volleyball clubs must not be confused with senior men's RPL squads.

## Special findings

- `lp-nadir`: the primary Zenit website denied direct automated retrieval; don't infer current players from a cached old season page. Its 46 fictional Nadir names are owner-approved **creative drafts**, not official dated roster verification. A secondary [official 2026/27 programme](https://pro.fc-zenit.ru/lokomotiv_ch_2026_27) supplies [two specifically reviewed transfer leads](NADIR_TRANSFER_CROSSCHECK.md), **not** a complete roster or data-reuse license.
- `lp-statika-m1`: Dynamo Moscow explicitly has a [2026/27 squad page](https://fcdynamo.ru/teams/dynamo/2026-2027/players/), but this still needs as-of snapshot checks.
- `lp-nizon`: the Akron first-team index currently yielded "К сожалению, данных не найдено" to the available text view; its [dated 2026/27 match protocol](https://fcakron.ru/game/287) can be used to verify *appearances*, not a complete eligible roster.
- `lp-statika-m2`: use the [Makhachkala first-team squad](https://dinamo-mx.ru/list/osnovnoj-sostav-dinamo-mahachkala/) rather than the similar youth/MFL and Dinamo-2 URLs.
- `lp-chuzhbina`: Rodina's current [team page](https://rodina.moscow/team/team/squad) exposes position/DOB/citizenship fields, but does not provide permission to copy and redistribute the whole dataset.

## Next ingestion steps and hard gates

1. Freeze as-of date, obtain lawful/compatible data sourcing and redistribution basis. An indexed web page is evidence of access, **not a license**. If no suitable basis exists, retain the verified source links for manual reference and develop a different independently authored or permissioned database for release.
2. For each club compare official dated registration reports, dated match protocols and staff announcements. Resolve duplicated names, role changes, player loans and academy/minor eligibility. Mark unknown facts as unknown.
3. Assign independent fictional identities/person IDs, original skill estimates, field-level provenance and date/version checks. Create no source-derived production player data under the current M0 `fictional-rpl-scale` manifest.
4. Build the next **separately versioned M2 pack** only after documentation/rights approval. Test compatibility with existing M0 saves and perform the mandatory M0 exit audits before authorizing M1.

**Status:** 16 club website/source candidates identified, 0 club rosters validated for the requested as-of date, 0 licensed player rows imported, 15 non-Nadir teams still need parody person drafts. No finished 2026/27 player database is claimed.

## Second official federation-source discovery (2026-10-14)

All 16 2026/27 RPL participants also have individually matched [RFU Cup team index URLs](RFS_CUP_TEAM_INDEX_FEASIBILITY.md), recorded as link-only pointers in [`data/drafts/liga-rfs-cup-team-index-links-2026-10-14.json`](../data/drafts/liga-rfs-cup-team-index-links-2026-10-14.json). These Cup pages are mutable and **not** dated RPL registrations or a data-use grant. Do not revise the 0/16 verified-roster or zero imported-facts statuses; the specific stale Zenit entries are demonstrated [here](NADIR_RFS_CUP_CROSSCHECK.md).
