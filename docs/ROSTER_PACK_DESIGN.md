# Proposed M2 factual roster pack contract (design only)

**Status:** proposed implementation details; owner has approved the **real prototype + original parody identities** principle but NOT this exact file schema, source rights or playing ratings. Existing M0 `Catalog` and revision-0 saves remain unchanged.

## Data separation

- `fictionalClubId`: stable `lp-*` key in a separately versioned M2 catalog; never derive identity by name or display label.
- `personId`: permanent original `lp-person-*` key, assigned once and retained after transfers, citizenship changes, coaching changes or name edits.
- `fictionalDisplayName`: original author-approved, stable for a started career; names are not identity keys. Optional nickname and abbreviated shirt label are independent presentation fields.
- `personRole`: footballer, coach, management, medical or support; a career can later transition between roles without changing person ID.
- `birthDate`, `nationalityCodes`, `primaryPosition`, `secondaryPositions`, `registrationStatus`: **separately verified source facts**, dated, with explicit missing/uncertain states. Calculate age from date of birth on the game date. Eligibility under rules must not be inferred from a passport alone.
- `affiliations`: dated, validated club/person/role relationships, not embedded permanent team ownership. One individual can move clubs; conflicting simultaneous registrations require review.
- `technical/mental/physical/goalkeeper attributes`: project-authored gameplay values using a documented cross-league calibration method, not transferred ratings from an existing football-management title or directly from market value.
- `rulePackId`/`rulePackVersion`: independent of `catalogPackId`/`catalogPackVersion`. Rules edition and underlying source record snapshot must not silently change mid-career.

## Source provenance and rights fields

Each factual field or internally cross-referenced cluster must retain a `sourceRecordId`, provider name, source URL, verified-at and effective-as-of date, rights/terms URL and human review status. The pack manifest must record whether copying/reproducing fields, redistributing downloadable browser content and derivatives are permitted by an applicable license or grant, with expiry where applicable. A publicly accessible webpage is not sufficient evidence of a license. Keep personally identifying provider identifiers out of player-visible pages. Photos and real crests are excluded unless separately permitted.

Wikidata's original structured records are generally available under CC0, but availability, entity ambiguity, historical memberships and linked assets still require independent checking. Other providers may have significantly more restrictive database, scraping and redistribution terms. No bulk collection is authorized on the basis of this design alone.

## Ingestion and release checklist

1. Freeze intended season snapshot (initial request: **2026-10-14**) and list all 16 genuine competition participants.
2. Review source collection/redistribution rights **before** bulk acquisition and before committing data to the public proprietary repository.
3. Map each verified factual prototype to an original fictional person ID/name; resolve duplicate transliterations, transfers, rentals, different passports and academy minors.
4. Check 16 clubs, unique person IDs, valid birth dates, effective registrations, position sets, staff roles, absence of source image assets, age limits and manifest provenance.
5. Run full baseline regression suite; test pack freeze when a saved career is started, and rejection of a mismatched pack. Do not overwrite the M0 seed pack.
6. Hold external release until rights, effective RFU sporting regulation editions and brand/publicity review pass. M0 completion still requires its separate full-repo two-pass audit.

**Current recorded facts:** the draft contains 46 fictional names for «Надир» with stable IDs and zero asserted verified real roster facts; 15 other clubs have approved identities/badges but no roster facts yet. Do not report a verified 16-club 2026/27 personnel database.

## Wikipedia sourcing for future prototype facts (owner instruction 2026-10-14)

Wikipedia is now the **preferred first research/reference source** for real 2026/27 prototype people and roles. Use the [version-pinned 16-club source map](WIKIPEDIA_ROSTER_BASELINE.md) before official date-sensitive crosschecks. This does not change the still-proposed pack shape or approve source-derived playable facts. Any later person-level `birthDate`, `nationalityCodes`, `primaryPosition`, coaching/board role and loan/affiliation must carry the source revision and observation date, a separate effective date if known, and a legal-use review. Wikipedia's season *appearance* list is not a registered-player list. Keep minors and second/youth-team affiliation separate from senior eligibility. The `lp-person-0004` / `lp-person-0018` Nadir prototype placement observations are research-only; approved fictional identities and M0 saves stay unchanged.
