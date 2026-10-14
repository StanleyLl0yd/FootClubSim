# 2026/27 squad source discovery register (not a playable data pack)

**Research date / intended snapshot:** 2026-10-14. The candidate primary-source URLs and their status are in [`data/drafts/liga-roster-sources.json`](../data/drafts/liga-roster-sources.json). This document lists **source locations only**, not the bulk content of third-party player/staff databases, and does not authorize automated scraping, database redistribution or protected image use. See [source/rights rules](DATA_SOURCES.md), [roster pack contract](ROSTER_PACK_DESIGN.md) and [M2 backlog #91](https://github.com/StanleyLl0yd/FootClubSim/issues/91).

**Research source order:** start from [revision-pinned Wikipedia personnel articles](WIKIPEDIA_ROSTER_BASELINE.md) for all 16 clubs; use the official links below for **independent dated verification**, particularly registrations, transfers and appointments. [Wikidata P54 diagnostics](WIKIDATA_ROSTER_FEASIBILITY.md) are supplementary entity/field cross-checks, not a replacement for Wikipedia and not proof of a current squad. The difference between research priority and official evidentiary authority is defined in [DATA_SOURCES.md](DATA_SOURCES.md).

## Official club-source verification references

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

## First dated match-participation evidence (2026-10-14)

[Two played 2026/27 match records](DATED_MATCH_APPEARANCE_CROSSCHECK.md) independently confirm narrow appearance observations on 2 September (RFU Cup Zenit - Dinamo Makhachkala) and 10 October (RPL Krasnodar - Zenit). Structured aggregates and two targeted draft-ID spot checks are in [`data/drafts/liga-dated-match-observations-2026-10-14.json`](../data/drafts/liga-dated-match-observations-2026-10-14.json). This **does not** establish three verified RPL registration denominators: match appearances, unused bench places and current-squad registration are different states. Rights review and all 16 as-of roster gates remain blocked.

## Dated federation fixture source coverage (2026-10-14)

In addition to the mutable [16 RFU Cup team index pages](RFS_CUP_TEAM_INDEX_FEASIBILITY.md), [eight completed 4–5 August 2026 official federation **fixture pages**](RFS_CUP_ROUND1_SOURCE_COVERAGE.md) provide **one concrete historical dated match pointer for every one of the 16** fictional participant clubs. [Machine-readable link-only mapping](../data/drafts/liga-cup-round1-match-sources-2026-10-14.json) and tests keep these separate from the six-club more recent [dated participation research](DATED_MATCH_APPEARANCE_CROSSCHECK.md). The August fixtures precede later transfers; they prove neither active October registration nor redistributable player data. All 16 date-frozen as-of roster verifications remain **unresolved**.

## RFU under-20 first-round publication cross-check (2026-10-14)

The [RFU article dated 6 August 2026](RFS_YOUTH_ROUND1_CROSSCHECK.md) independently reports **21 under-20 player appearances across 10 named clubs** in the first 4-5 August Cup round. The [research-only aggregate record](../data/drafts/liga-rfs-youth-round1-summary-2026-10-14.json) also links one dated «Надир» / Daniil Kondakov case to the 5 August official protocol, retaining the immutable approved fictional person ID. The article did not name six other clubs; this does **not** prove that their youth-player count was zero. Age reports and Cup appearances do not establish 14 October RPL registrations, full staff/roster denominators or reuse rights. **0/16** complete RPL registrations verified and **0** source-derived playable facts imported.

## Owner-selected Wikipedia-first research source (2026-10-14)

The owner now directs that **Wikipedia is the first research source for player, coaching, leadership and support-personnel prototypes**. Consult the three **revision-pinned** Wikipedia articles and the 16/16 club-heading mapping in [WIKIPEDIA_ROSTER_BASELINE.md](WIKIPEDIA_ROSTER_BASELINE.md) and [its structured source metadata](../data/drafts/liga-wikipedia-source-map-2026-10-14.json). The 2026/27 Wikipedia *squads* article explicitly lists **RPL match participants**, not all registered/eligible players; the Zenit club overview separately exposes first-team, second-team, youth and loan roles. This changes the **discovery priority**, not the status of the older 16 official club-site links: they remain valuable for independent effective-date and registration dispute resolution. The primary legal/source conditions, zero verified full 14 October club rosters, zero playable imported facts, existing M0 synthetic pack and owner-approved 46 Nadir identities remain unchanged.
