# Football data provenance and permissions (M0)

Status: policy and proposed workflow; no third-party dataset has been imported or licensed for redistribution.

**Approved gate allocation:** [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md) requires source/revision/rights contracts and an original-only M0 synthetic pack now, but postpones complete as-of 2026-10-14 RPL personnel registration and playable person data/rights clearance until **M2**. This neither licenses Wikipedia content nor removes the M0 prohibition on third-party data imports without a review.

**M0 synthetic manifest:** [`data/packs/m0-synthetic-manifest.json`](../data/packs/m0-synthetic-manifest.json) declares the authored fictional generator, seed, pack version and absence of third-party records/artwork. `tests/manifest.test.mjs` checks it against actual generated data. This is an auditable **project declaration**, not external license proof or an authorization to redistribute third-party records. A real RPL data pack requires independently verified rights and a separate release review. The M0 fictional-only manifest is now parsed by the pure, strict and bounded `src/core/provenance.ts` validator. It rejects unknown fields, inconsistent seed-derived pack versions, invalid dates, any declared third-party football records/artwork, and any assets not supported by the M0 schema. `tests/provenance.test.mjs` checks real manifest roundtrip, mismatch and malformed cases. This **only validates the author's declaration** and does not independently prove origin, authenticity or permission for real-world databases.

## Owner update: 2026-10-14, parody prototypes and badges

The owner subsequently approved all 16 exact fictional names and original three-ring badges; real 2026/27 squad/staff memberships, ages, nationalities and role/ability **as factual starting-prototype inputs** with fictional person names. See [ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md). This **changes the intended future fictional roster design**, but does not confer rights to reproduce a third-party club database or authorize unlicensed bulk scraping. Person-level facts and provenance remain unverified. The 46 approved «Надир» names and a 15-club worklist are stored under `data/drafts/` and are not part of the playable M0 data pack.

## Approved «Лига приколов» data scope (2026-10-14)

The initial decision called for independent fictional personnel. It is **superseded for the eventual release** by the later owner approval of source-verified real 2026/27 personnel as recognizable parody prototypes, with independently authored display names and original branding. Real effective RPL/RFU/IFAB sporting rules remain mandatory. See [ADR-0004](adr/0004-liga-prikolov-rpl-rules.md).

This is **not** permission to ship an unlicensed real roster database, real team badges or other protected third-party assets. Keep all game participant IDs independently authored and stable. The source RPL participants are design references for creative naming; source references do not establish permission to reproduce logos, photographs, trade dress or databases. The exact 16 aliases and original badge geometry are approved by the owner, but release rights are not cleared. Full sporting-rule verification, later amendments and source-edition tracking remain **open** under [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15). Do not represent unverified rules as compliant with official documents.

## Data sources

| Candidate | Possible facts | Status for bundling |
| --- | --- | --- |
| Transfermarkt | Rosters, dates, transfer/contract and valuations context | **No automated scraping or bulk copying.** Its terms prohibit automated access/copying without authorization. Redistribution is not authorized by the fact that a page is public. |
| Official club websites | Player roster, position, appearances, biographies | Review each site's terms and licenses; obtain permission for automated collection and redistribution as appropriate; logos and photos are separately rights-controlled. |
| RFU/RPL official documents | Competition regulations, published schedules and results | Source authority for rule design, but access/redistribution/automation still need rights review. |
| Wikidata (CC0 where applicable) | Basic independently licensed structured facts | Validate coverage, entity matching, dates and database provenance. Do not assume every linked image has CC0 rights. |
| Independent licensed sports-data API | Statistics, player identities, schedules | Use only with written subscription/license terms covering client-side redistribution/offline packs and public GitHub where applicable. |
| Synthetic records | Fictional teams/players, balancing/test fixtures | **Allowed M0/M1 bootstrap**; avoid resemblance to real branded clubs and personnel. |

Official regulations for season 2026/27 can be located through [RFU official document list](https://www.rfs.ru/subject/1/documents?cat_id=24&subCategoryId=17). The regulations must be checked **before** treating a particular quota, schedule constraint, disciplinary rule or tiebreaker as authoritative.

Relevant Transfermarkt terms: [Terms of Use](https://www.transfermarkt.us/intern/anb), including § 11.1 restricting bots, spiders and automated copying.

Cross-document rule source editions and pending lawful-use decisions are tracked in [M0_RPL_RULES_MATRIX.md](M0_RPL_RULES_MATRIX.md). These citations do **not** license protected player/club data.

## Import process

1. Register potential source, URL, terms/version and rights holder.
2. Classify fields, territory, purpose, permitted collection method, redistribution and refresh rights.
3. Require documented permission or compatible license **before** bulk acquisition or inclusion in public repository/game pack.
4. Acquire only approved fields through permitted means, without proxies or attempts to evade access restrictions.
5. Normalize under our own stable IDs, attach field/source provenance and verify identity matches manually when ambiguous.
6. Run schema validation, deduplication, cross-reference integrity and data-quality reports; quarantine errors.
7. Build a versioned read-only data pack and separate rights manifest; independently review every image, logo and photo.
8. Release a new pack for **new** careers only; never overwrite an existing saved career.

No one should assume public sports statistics or player biography details grant an automatic commercial database license. Keep provider data out of test fixtures and CI logs until rights are established.

## Catalog structure and review checklist

Each source/asset declaration should include:

- `sourceId`, URL/provider, retrieval or verification date, field coverage and license/permission reference;
- allowed processing, publication, redistribution and update methods;
- attribution requirements (when any), obligations and expiry/revocation policy;
- estimated accuracy, ambiguity flags and human reviewer;
- rejection reason if unsuitable.

For a pack release, document `packId`, `schemaVersion`, `asOfDate`, provenance manifest checksum, number of included/declined records, rule-version source, and compatibility with engine/save schema. Counts must be produced by tooling, not estimates presented as facts.

## RPL first and realistic game attributes

For the approved «Лига приколов» initial release, use approved original parody identities with carefully sourced, rights-reviewed real 2026/27 factual prototypes under verified RPL sporting regulations, not a copied proprietary roster. A separately licensed factual pack would require a later owner decision and its own rights review. **Game attributes remain our original design**, not copied ratings from another game or a linear conversion of Transfermarkt market value. Estimating technical/physical/mental scores needs transparent methodology, uncertainty and bias checks, as described in [DATA_MODEL.md](DATA_MODEL.md).

Season 2026/27 data may be incomplete or inconsistent across sources; unresolved identities/contract terms must remain unknown rather than invented facts. Missing fields can receive explicitly labeled **gameplay estimates** where appropriate, but must not be represented as official facts.

The [measured M0 original-content inventory](M0_ORIGINAL_CONTENT_REVIEW.md) records the Git-tracked asset/artwork and synthetic-versus-research-only boundary with source and CI evidence. It does **not** replace independent release-specific rights review.

## Local repository review automation

`python3 scripts/repo_audit.py` checks Git-tracked filenames, declared
assets, suspicious credential patterns and external GitHub Actions pins;
its deterministic inventory figures are recorded in CI. Undeclared
images, logos, archive/database dumps and external datasets cause a
review failure rather than silently shipping in the repository.
Adding a path to the synthetic pack's `assetPaths` list is **not** itself
permission or evidence of ownership. All real-world football facts,
photography, crests and database records still require an independent
documented provenance and redistribution-rights review.

## Repository and privacy boundaries

This repository is public and proprietary. Copyright in our code does **not** transfer rights to external databases, player photos or club branding. Do not commit API credentials, unlicensed datasets or personally sensitive records. Review the handling of minors and publicity/privacy rights before publishing personal data about academy players.

## Wikipedia-first prototype research decision (2026-10-14)

Per the owner's later instruction, use **Wikipedia first** for discovering roster prototypes, biographies, dates, roles, management and coaching, with edition-specific historical citations. [Reviewed Wikipedia revisions and the 16-club section index](WIKIPEDIA_ROSTER_BASELINE.md) establish links and limited affiliation observations, not full 14 October RPL registration lists. The Wikipedia *2026/27 squads* article tracks **players with an RPL appearance**, not the eligible registered denominator. Separately use official dated documents to resolve transfers, loans, registered-team eligibility and acting-coach/appointment changes. Wikipedia prose is generally CC BY-SA 4.0 and media carry their own licensing requirements; avoid copying full article text, tables, pictures or crests into this proprietary repo/game absent a documented rights plan. Limit initial repository artifacts to links, revision metadata, aggregate evidence and carefully selected case notes. The source priority change is **not** an authorization to ingest a Wikipedia dataset or overwrite existing gameplay/saves.
