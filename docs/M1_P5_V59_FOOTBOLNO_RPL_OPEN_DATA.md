# M1 P5: Russian league-235 no-cost event coverage audit (v59)

**22 October 2026. Candidate reference data; NOT a successful realism gate.**

Publisher: [Footbolno Open Data](https://footbolno.ru/otkrytye-dannye).
[Live manifest](https://footbolno.ru/data/index.json), verified accessible
2026-10-22, explicitly claims **CC BY 4.0** for the football data (including
commercial use with attribution). Attribution:
"Источник данных: footbolno.ru - https://footbolno.ru/otkrytye-dannye".
The site's input data originate from heterogeneous official sources,
providers and Wikipedia, so **upstream licensing/provenance is not
independently cleared** by its own CC BY declaration.

Public documented endpoints:

- `https://footbolno.ru/data/league/235-matches.csv`: RPL season
  matches and final results (league ID 235).
- `https://footbolno.ru/data/bundles/all-events.csv.gz`: all
  competitions' recorded match events. Kinds: `goal`, `own`,
  `penalty`, `yellow`, `red`, `shootout`.
- `https://footbolno.ru/data/index.json`: schema, snapshot updated
  timestamp and publisher license declaration.

`scripts/m1-p5-footbolno-rpl-events.mjs` analyzes **only the
development season 2023/24**. It rejects incomplete season fixture
coverage (240 completed games), invalid or duplicate match IDs,
unsupported CSV headers, malformed event rows associated with selected
matches, bad gzip and excessive byte/row sizes. The CLI only opens two fixed file basenames from its working directory,
never arbitrary paths from command-line arguments. Zero eligible source
matches cause the hosted evidence check to fail (not a green false-positive).
It SHA-256 hashes the
actual input files and reports aggregate season scores, outcomes, goal
and event-tag counts and important missing-data denominators. It does
not include player names, raw CSV rows or executable source code from
the supplier in the result.

Crucial caveat: **the presence of some event rows for a match is NOT
proof all its bookings, penalties and goals were recorded**. The
summary unconditionally marks complete event coverage as unverified
and avoids publishing per-match zero-card rates when even some finished
matches have no event rows. It does not claim league disciplinary
eligibility, official clinical injuries or referee authenticity.

Footbolno's documentation specifically excludes xG, advanced shot
statistics and complete per-match lineups. Therefore xG, shots and
clinical injuries are marked `null` rather than silently calibrated
by an unrepresentative historical substitute. Season labels are recognized in the publisher's full `YYYY/YYYY` form
as well as the shortened legacy `YYYY/YY` form, not from input dates alone.
The 2024/25 season is
reserved as the scientific holdout and is **not evaluated or tuned**
in this diagnostic. The authors' license claim alone does not permit
a reviewer to assume the upstream sources are correctly relicensed.

Run locally after acquiring the raw files from these exact URLs:

```sh
mkdir -p /tmp/footbolno-research
# Place the downloaded files as matches.csv and events.csv.gz here.
(cd /tmp/footbolno-research && node /path/to/FootClubSim/scripts/m1-p5-footbolno-rpl-events.mjs)
```

A separate, scoped CI-research action may download these files into an
ephemeral workspace, never commit them or upload them as artifacts,
and print aggregate coverage with original SHA-256 fingerprints.

This P5 increment is a serious prospect for results/cards/penalty
**reference coverage**, NOT a P5 pass without full-event completeness,
metric equivalence, rights review and agreed preregistered tolerances.
P3/P5 and M1 exit remain open. M2 prohibited.
