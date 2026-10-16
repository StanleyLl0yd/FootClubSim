# M1 P5: hash-pinned RPL CSV candidate inspection

**2026-10-17. Offline inspection utility only. NOT an approved/licensed
benchmark, release gate, calibration result, or M1 acceptance.**

`node scripts/m1-p5-reference-candidate.mjs` accepts a manually acquired
historical RPL CSV snapshot advertised by footbolno.ru and inspects only
result distributions for one explicitly selected season. It performs no
network requests and imports nothing into the game, browser storage or M0.

Data source/attribution: https://footbolno.ru/otkrytye-dannye
Advertised file: https://footbolno.ru/data/league/235-matches.csv

Example, **only after acquiring a local snapshot independently**:

```bash
shasum -a 256 /path/to/rpl-matches.csv
node scripts/m1-p5-reference-candidate.mjs \
  --file=/path/to/rpl-matches.csv \
  --season=2024/2025 \
  --sha256=EXACT_64_CHARACTER_LOWERCASE_SHA256
```

The complete snapshot hash, including any UTF-8 BOM, must match before
parsing. CLI input is a local UTF-8 CSV only, limited to 16 MiB, 100,000
rows, 64 columns and 4096 characters per cell. Parser validates headers,
quoted CSV, record widths, unique match IDs and RPL competition ID `235`,
season labels, allowed statuses, distinct team IDs and bounded integer
normal-time goals for selected finished matches. Other seasons, live,
scheduled and cancelled matches are excluded with explicit counters.
Any invalid selected finished record fails closed; no guesswork is used
for missing goals. Counts, home/draw/away/scoreless/both-scored Wilson
95% intervals and total goals sample-mean/normal-approximation interval
are reported from observed results only. A single match has null mean
interval; metrics not included in this dataset are not fabricated.
The report also includes observed home/away goal totals and **finished-only**
club-coverage ranges (different clubs, games per club, home/away appearances)
plus repeated directed home-away pairings with different match IDs. These
are anomaly/completeness-review signals, **not** validation of a complete
league schedule, club identities or a known double round robin. Scheduled,
live and cancelled rows are excluded from these coverage ranges.

Reports intentionally contain no source player/team names, fixture rows,
raw events or local path. They always state
`UNAPPROVED_EXTERNAL_REFERENCE_CANDIDATE_NOT_CALIBRATED`,
`UPSTREAM_RIGHTS_NOT_VERIFIED` and `NOT_ESTABLISHED` for season completion.
Even a valid local SHA, a valid CSV and successful CLI do not prove
primary-source reliability, complete schedules, upstream permission or
statistical realism. Source is mutable; record retrieval date, exact file
hash, season coverage and provenance in a separately reviewed manifest.

Do **not** commit the original downloaded files. Keep privately inspected
files in ignored `data/reference-private/` or outside the repository.
Before a benchmark can be used for acceptance, finish source-rights and
completeness review, independently cross-check match outcomes, register
calibration/holdout seasons and acceptance bands before tuning, then
execute representative v8 simulations with compatible metric definitions.
The tool is deliberately not wired into CI as a live external download.

Related: [reference candidate and legal screening](M1_P5_REFERENCE_SOURCE_CANDIDATES.md),
[calibration protocol](M1_CALIBRATION_PROTOCOL.md), [issue #31](https://github.com/StanleyLl0yd/FootClubSim/issues/31).
