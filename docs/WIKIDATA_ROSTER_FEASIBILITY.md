# Wikidata 2026/27 roster feasibility and provenance gate

**Date assessed:** 2026-10-14. **Result:** CC0 source eligible for consideration; actual 16-club as-of roster coverage **not yet measured or verified**. Do not infer zero coverage or full coverage from this statement. No Wikidata player facts were imported.

## Permission and technical baseline

- Wikidata structured entity/property statements are published under CC0: [Wikidata:Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright) and [Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing). This applies to structured records, **not automatically** images, Wikipedia article text, trademark or personal/publicity rights.
- Match players to clubs using [member of sports team (P54)](https://www.wikidata.org/wiki/Property:P54) statements with [P580](https://www.wikidata.org/wiki/Property:P580) and [P582](https://www.wikidata.org/wiki/Property:P582) time qualifiers; possible match fields are [P569](https://www.wikidata.org/wiki/Property:P569) birth, [P27](https://www.wikidata.org/wiki/Property:P27) citizenship and [P413](https://www.wikidata.org/wiki/Property:P413) sporting position. Field availability and accuracy require individual measurement.
- [Wikidata Query Service](https://www.mediawiki.org/wiki/Wikidata_query_service/Implementation) has per-query/time constraints and index lag; follow [data access guidance](https://www.wikidata.org/wiki/Help:Data_access), User-Agent/rate limits and Retry-After. Never build a massive or aggressive crawl.
- A Wikidata statement may cite another database; importing the CC0 *structured statement* is legally distinct from copying that external site's tables, prose or photos. Record the actual acquisition source and investigate conflicts.

## Required as-of methodology

1. Resolve and manually verify **all 16** actual-club QIDs before querying; never infer QIDs from approximate names or an unrelated club. Record each mapping and date reviewed. Keep this mapping outside the player-visible fictional roster.
2. Fetch bounded P54 statements, including statement IDs, rank, provenance, optional P580/P582 and relevant reference timestamps. Use historical snapshots/revisions where necessary: a live WDQS result alone is not a frozen historical 2026-10-14 snapshot.
3. Treat an absent P580 or P582 as **unknown temporal coverage**, not proof of membership. Treat dated conflicting clubs, loans, academy memberships and coaches as manual review cases. Match the statement's date interval to 2026-10-14 using **explicitly documented** inclusive/exclusive semantics.
4. Compute for each club: independently verified real first-team roster denominator from an authorized source; Wikidata P54 candidates; temporally supported candidates; unqualified/ambiguous candidates; date-of-birth/position/citizenship completeness; missing personnel; coach/support coverage; source reference quality. **No numerical coverage ratio can be claimed until the denominator is established.**
5. Redact unnecessary personal identifiers, exclude third-party image bytes/crests, and review minors/publicity. Separately verify RFU registrations, nationality eligibility and exact effective rules.
6. For approved records, retain Wikidata statement/entity revision, as-of and collection dates, human reviewers and rights evidence. Rejected/unverified facts never enter a playable pack.

## Query pattern (diagnostic only)

Replace `wd:Q_VERIFIED_CLUB` with a **manually verified real QID**, not a fictional club key. Select the statement shape below, then conduct historical and registration checks. This query retrieves potential candidates, **not an eligible first-team roster**.

```sparql
SELECT ?person ?membershipStatement ?start ?end WHERE {
  ?person p:P54 ?membershipStatement .
  ?membershipStatement ps:P54 wd:Q_VERIFIED_CLUB .
  OPTIONAL { ?membershipStatement pq:P580 ?start . }
  OPTIONAL { ?membershipStatement pq:P582 ?end . }
}
```

Optional ?start/?end and absent references are quality findings, not acceptable substitutes for membership evidence. A single P54 can cover earlier seasons, reserve sides or insufficiently specific team entities; screening must remain explicit.

## Staging contract

The independent, non-playable [personnel manifest](../data/drafts/liga-personnel-pack-v1.json) is versioned `0.1.0` with 46 approved creative identities, **zero qualified factual rows**, and unchanged M0 compatibility. Its strict checks live in [scripts/validate-personnel-draft.mjs](../scripts/validate-personnel-draft.mjs) and [tests/personnel-draft.test.mjs](../tests/personnel-draft.test.mjs). The candidate validation function verifies declared source/rights metadata and basic field structure only: **it cannot establish legal authority, truth or employment/registration by itself**. No fictional names or source rights have been independently cleared for external release yet.

Next: establish verified QID mappings and bounded source coverage measurements, then resolve remaining gaps with truly licensed providers or separately authored fictional fallbacks. Keep [issue #91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), [rights/rules #15](https://github.com/StanleyLl0yd/FootClubSim/issues/15) and the M0 audit [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) open.

## Entity disambiguation milestone (2026-10-14)

All **16 club-level Wikidata entity IDs** have been identified and frozen in [the QID mapping](../data/drafts/liga-wikidata-club-map-v1.json), with explicit `lp-*` foreign keys and one canonical football-club page per participant. [Tests](../tests/wikidata-club-map.test.mjs) prevent duplicate/missing mappings and accidental promotion of these research pointers into playable personnel data.

**Important disambiguations:** Moscow Dinamo football club is `Q17497`, not the broader `Q1269117` multisport society; Samara Krylia is `Q274778`, not its Moscow namesake. Makhachkala Dinamo `Q2494171` carries two historical inception dates (1927/2021) and requires an additional identity-continuity review. These mappings establish **club entities only**, not legal entities, squad membership, coaches or registered players.

**Coverage remains unmeasured:** no successful dated `P54` extraction/denominator reconciliation is recorded. Do not translate 16/16 matched clubs into 16/16 verified rosters. The automated WDQS query was not run as part of this check; do not invent candidate counts.

## Bounded, reproducible P54 diagnostic

Run `node scripts/wikidata-p54-coverage.mjs --club=lp-nadir` for Zenit alone, or `node scripts/wikidata-p54-coverage.mjs` for all 16 club QIDs. The dedicated [GitHub Actions diagnostic](../.github/workflows/wikidata-coverage.yml) executes the all-club query when relevant code changes. It does **not** control production app builds or copy player statements into Git.

The script reads the checked [QID mapping](../data/drafts/liga-wikidata-club-map-v1.json), performs at most one limited `P54` query per club (1,501-row ceiling, 30-second client timeout, 1.5-second delay between queries), honors HTTP 429 by halting, and prints only aggregate statistics. Individual person QIDs, names, statement references and dates **remain in process memory only** and are never logged or included in committed artifacts.

This diagnostic deliberately includes all historical membership statements, even deprecated ranks, because it measures discovery coverage rather than providing a verified roster. Its categories are:
- `boundedCandidate`: both dates provided and the serialized date interval covers 2026-10-14, pending precision/rank/source and roster verification.
- `openEndedCandidate`: the start date is at or before 2026-10-14 but no end qualifier is present, **not** proof of current membership.
- `unknown`: missing start, uncertain date precision or insufficient temporal details.
- `outside`: clearly before or after 2026-10-14.

The report keeps distinct person and statement counts separate, deduplicates repeated statement bindings, treats network failures as `query-failed` **not zero candidates**, and rejects truncated results instead of asserting full coverage. No tested category represents RFU registration. A client-side query of today's Wikidata graph is **not** a frozen historical snapshot; true historical verification will need entity revisions/effective-source evidence. Never translate `P54` counts into 2026/27 roster completeness without a licensed first-team denominator and manual reconciliation.
