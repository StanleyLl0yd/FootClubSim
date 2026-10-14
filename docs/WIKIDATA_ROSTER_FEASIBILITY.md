# Wikidata 2026/27 roster feasibility and provenance gate

**Date assessed:** 2026-10-14. **Result:** CC0 source eligible for consideration. Historical P54 discovery counts for all 16 clubs **have been measured**; actual first-team as-of roster completeness remains **unmeasured and unverified**. No Wikidata player facts were imported.

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

## Live WDQS results, 2026-10-14

[GitHub Actions run 38537433952](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38537433952) successfully queried all 16 mapped club QIDs. The counts are recorded **only as aggregates** in [the dated diagnostic JSON](../data/drafts/liga-wikidata-p54-diagnostic-2026-10-14.json). Query script commit: `0cb125d081a612bbb202cde50b11f432e0f111c5`, extracted at `2026-10-14T08:46:41.134Z` UTC.

- **7518** cumulative club-person pairs, including past club membership; the same human can appear for several clubs. **Not** unique persons across the entire league.
- **8297** historical P54 statement records.
- **0** person-club pairs have both finite qualifiers spanning the requested date.
- **504** have a start date no later than 2026-10-14 and no end date. This is a lead for review, *not active registration*.
- **1761** lack enough temporal qualifier precision or known dates.
- **5253** have only statements clearly outside the target date.

«Надир»/FC Zenit: **733** all-time people, **792** statements, **43** open-ended date candidates, **295** temporally unknown and **395** outside-date. These are discoverability metrics, **not** evidence that 43 players are in the current squad.

The result shows why CC0 availability is not sufficient for a playable league database: Wikidata lacks conclusive dated registration assertions for many historical links, and every 2026/27 squad still lacks an independently established roster denominator. Some P54 entries may be non-current, historical, or wrong; the current graph does not freeze Wikidata state as it existed on 2026-10-14. All 16 first-team rosters remain **not verified**, and M0/M2 publishing remains blocked.

## Candidate person field completeness (P569/P27/P413)

The supplementary [bounded diagnostic](../scripts/wikidata-candidate-fields.mjs) checks which **open-ended P54 candidate people**, as identified by the previous procedure, have at least one non-deprecated Wikidata value for date of birth (`P569`), citizenship (`P27`) and general position (`P413`). Calls to `wbgetentities` use a bounded batch (up to 40 QIDs), rate pacing, User-Agent and maxlag, with no real-world player identity or Wikidata person QID retained in published results. The [separate diagnostic workflow](../.github/workflows/wikidata-candidate-fields.yml) is for live research, not the production build.

**Warning:** mere presence of `P27` does not establish RFU foreign-player status; `P413` may be coarser than the game's GK/CB/DM/etc positions; and `P569` does not itself confirm the accuracy of a birthday. Even all-three-field coverage does not constitute an effective-date roster validation, contract or registration proof, or permission to reuse third-party photographs.
