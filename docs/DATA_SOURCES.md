# Football data provenance and permissions (M0)

Status: policy and proposed workflow; no third-party dataset has been imported or licensed for redistribution.

**M0 synthetic manifest:** [`data/packs/m0-synthetic-manifest.json`](../data/packs/m0-synthetic-manifest.json) declares the authored fictional generator, seed, pack version and absence of third-party records/artwork. `tests/manifest.test.mjs` checks it against actual generated data. This is an auditable **project declaration**, not external license proof or an authorization to redistribute third-party records. A real RPL data pack requires independently verified rights and a separate release review.

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

Prefer actual official and rights-cleared factual player/club data. **Game attributes remain our original design**, not copied ratings from another game or a linear conversion of Transfermarkt market value. Estimating technical/physical/mental scores needs transparent methodology, uncertainty and bias checks, as described in [DATA_MODEL.md](DATA_MODEL.md).

Season 2026/27 data may be incomplete or inconsistent across sources; unresolved identities/contract terms must remain unknown rather than invented facts. Missing fields can receive explicitly labeled **gameplay estimates** where appropriate, but must not be represented as official facts.

## Repository and privacy boundaries

This repository is public and proprietary. Copyright in our code does **not** transfer rights to external databases, player photos or club branding. Do not commit API credentials, unlicensed datasets or personally sensitive records. Review the handling of minors and publicity/privacy rights before publishing personal data about academy players.
