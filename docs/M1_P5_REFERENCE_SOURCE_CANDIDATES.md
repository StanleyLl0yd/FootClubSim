# M1-P5: candidate empirical football reference sources

**Research note, 2026-10-16. NO DATASET APPROVED, IMPORTED OR CALIBRATED.**
This is a source/rights screening inventory under #31, not a real-world
reference pack, an official 2026/27 RPL source or M1 exit evidence.
External publisher statements are claims to verify, not a legal opinion.

## 1. Candidate: footbolno.ru open Russian football data

- Publisher page: https://footbolno.ru/otkrytye-dannye
- Advertised RPL match CSV:
  https://footbolno.ru/data/league/235-matches.csv
- Advertised snapshot manifest: https://footbolno.ru/data/index.json
- Advertised full events bundle:
  https://footbolno.ru/data/bundles/all-events.csv.gz
- Publisher expressly labels its **data** CC BY 4.0, including commercial
  reuse, subject to source attribution and a direct link to its data page.
  This is a publisher statement; verify current terms and rights for the
  precise data/version before accepting it.
- Published match fields include stable match ID, league ID, dated season,
  status, home/away teams, normal-time home/away goals and round. The
  publisher describes minute-level goals, own goals, penalties and cards.
  Verify the downloaded CSV/event schemas before inferring a usable
  card or penalty rate; the site expressly says **no xG, shots, injury
  data or referee information** in its open data.
- The publisher says it aggregates material from leagues/federations,
  sports providers and Wikipedia. Its CC BY claim alone does not
  establish that it has all relevant upstream rights or that every
  historical match/event is factually correct. Independent source,
  completeness and redistribution review is still mandatory.

**Potential lawful use, if approved:** a date-frozen, attribution-bearing
historical RPL reference for empirical home/draw/away, total-goals,
scoreless-match and selected *verified* disciplinary distributions.
Do not publish/replicate the provider's raw records, names or events
until provenance and redistribution rights are independently cleared.

## 2. Secondary candidate: openfootball/football.json

- Repository: https://github.com/openfootball/football.json
- Publisher declares the fixtures/results data **CC0-1.0 / public domain**
  and documents many European top leagues with historical match scores.
  Review the particular upstream country's dataset/version separately.
- Can provide a separately labelled *cross-league engineering sanity
  comparison* for score/home-away distributions if content and terms pass
  review. Does **not** replace an authentic RPL benchmark; current
  Russian 2026/27 match coverage was **not verified** in this research.
- No claimed shot/xG/injury calibration coverage.

## 3. Not cleared for commercial automated benchmarking

- https://football-data.co.uk/contact.php
  Its published fair-use policy limits free files to private personal
  betting or academic use and explicitly excludes commercial/AI projects
  using heavy automated downloads. Do **not** automate ingestion for
  FootClubSim on the assumption that publicly accessible CSV is licensed.

## Acceptance gate before ANY external benchmark is used

1. Verify the **exact** provider license, underlying source rights,
   attribution, applicable commercial redistribution and current
   published terms. If ambiguous, obtain permission or choose another.
2. Inspect the actual source schema, revision or hash, dates, RPL
   competition identity, match exclusions and available metric
   coverage. No guessed shots/xG, inferred cards or missing=zero.
3. Freeze one attributable benchmark reference with URL, retrieval
   date, source revision/content SHA-256, season window, actual sample
   size, exclusion reasons and permissible redistribution decision.
   Keep raw material outside the public repository until approved.
4. Agree pre-registered numerical tolerance bands, separate calibration
   and held-out seasons, and account for incomplete 2026/27 season data.
   Avoid fitting to scorelines or retroactively selecting thresholds.
5. Publish outcome metrics only for **observed and permitted** fields,
   with confidence intervals and declared limits. Simulation data
   remains explicitly `NOT_CALIBRATED` until a full accepted campaign
   passes and M1 exit #3 is independently reviewed.

**Scope boundary:** Wikipedia remains the principal *roster/personnel
research* source for M2; this note does not alter it, certify RFU
registrations, or authorize any M2 dataset or implementation.

## Hash-pinned candidate inspection (2026-10-17)

The local-only [RPL CSV reference candidate inspector](M1_P5_REFERENCE_CANDIDATE_CLI.md)
validates manually acquired snapshots by SHA-256, CSV schema, league/season,
fixture identity/status and bounded normal-time goals. It reports only
anonymized descriptive distributions with uncertainty, never imports raw
provider data and **does not** authorize redistribution, calibration or M1 exit.

## Cross-provider 2025/26 discrepancy resolved at one match (2026-10-17)

The previously noted **609 vs 610 goals** provider conflict has now been
[localized to a single Rusfootball 3:0 vs officially corroborated 2:0
Zenit-Akhmat entry](M1_P5_2025_26_GOAL_DISCREPANCY.md).
The RPL-hosted next-round bulletin and Akhmat club match record both give
**2:0**. This explains the one-goal mismatch but does **not** establish
full-season fixture-by-fixture completeness, reuse rights or calibration.

## Publisher manifest declaration observed 2026-10-18

The current public [data index](https://footbolno.ru/data/index.json) explicitly
advertises `license: "CC BY 4.0"`, links to
[the CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/deed.ru),
and identifies its mutable league CSV template
`https://footbolno.ru/data/league/{league_id}-matches.csv`.
At the time of inspection its **self-reported** `updated` timestamp was
`2026-10-17T19:06:32+00:00`. These are publisher-controlled statements,
not an independently verified legal chain or immutable raw snapshot.

A new offline [manifest observer](../scripts/m1-p5-source-manifest.mjs) and
tests enforce exact locally captured manifest SHA-256, source/license URL
and mandatory RPL match-schema fields without outputting raw data.
The existing [manual snapshot workflow](../.github/workflows/m1-p5-rpl-source-research.yml)
now records both the manifest and CSV hashes; it does not run automatically
and has **not been dispatched as part of this change**. Actual 2024/25 CSV
match rows, independent primary results, upstream redistribution
permissions and benchmark calibration remain **UNVERIFIED**. Do not interpret
the publisher's CC BY declaration as permission to relicense any material
it may have received under a different third-party license.
