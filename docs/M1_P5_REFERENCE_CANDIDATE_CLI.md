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
league schedule, club identities or a known double round robin. A separate
`scheduleShape` section tests the **necessary** 16-club/240-finished-match
double-round-robin structure: 15 finished home and 15 away games per observed
club, no repeated directed pairings, and no unfinished rows in the selected
season. Each condition is reported independently; the combined
`consistentWithExpectedPattern` is true only when all pass. A positive
structural pattern is **not** proof that recorded goals, identities or match
dates are authentic, that a snapshot contains all real fixtures, or that
publisher licenses and independent archives have been verified. Therefore
`isCompleteSeason` stays `NOT_ESTABLISHED` even when all structural
checks succeed. Scheduled,
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

## Offline published-aggregate cross-check (research only)

Two publishers display concordant historical RPL **2024/25** result summaries:
[Чемпионат](https://www.championat.ru/football/_russiapl/tournament/5980/)
and [Sportbox](https://news.sportbox.ru/Vidy_sporta/Futbol/Russia/premier_league/stats/turnir_22151).
Observed counts as checked on 2026-10-17: 240 finished matches, 103
home wins, 65 draws, 72 away wins, 20 scoreless draws, 364 home
goals, 284 away goals and 648 goals total. The 16-club season is also
identified by the published team listing. These are **factual published
summary claims only**. The sites' feed independence, source rights and
license chain have **not** been established; counts have not been
corroborated against a complete independent match-by-match primary archive.

The source-labelled numerical summary is recorded in
[data/rpl-2024-25-published-aggregate-research.json](../data/rpl-2024-25-published-aggregate-research.json).
It contains no source fixture rows, player identities or third-party
images. Never use it to tune synthetic probabilities or turn a simulated
coincidence into approval. The reference dataset has not been
approved for production benchmarking.

After a real raw CSV file has been privately acquired, first use the
hash-pinned candidate CLI above and store its anonymized JSON report
outside version control. Then run:

```bash
node scripts/m1-p5-reference-reconcile.mjs \
  --candidate=/path/to/private-candidate-report.json \
  --published=data/rpl-2024-25-published-aggregate-research.json
```

The offline reconciliation checks nine integer counts, internal
arithmetic and source metadata. It reports precise disagreements or a
descriptive numerical match, always with explicit
`benchmarkApproved: false`, `sourceRightsReviewed: false` and
`seasonCompletenessEstablished: false`. Even an exact match
cannot establish verified provider rights, record completeness,
cross-publisher independence, referee/card/injury/shot realism, or any
pre-registered statistical acceptance range. Neither comparison result
is a CI realism gate or M1 exit approval.

## Optional GitHub Actions source probe (manual only)

For an environment where this ChatGPT session cannot download the source
CSV, a single **manual** GitHub Actions workflow is available:
[Actions: M1 P5 RPL snapshot research](../.github/workflows/m1-p5-rpl-source-research.yml).
In GitHub, select **Actions**, select that workflow and choose **Run workflow**
on the protected `main` branch. It has **no** push, pull-request,
cron or automatic dependency on the real provider and does not run during
ordinary CI.

The workflow runs with read-only repository permission, a fixed HTTPS URL
and 2024/25 season, a bounded private runner temp directory and a
60-second download limit. It computes the **actual downloaded-byte**
SHA-256 and outputs only that digest, byte count, UTC observation time,
anonymized candidate statistics and the unapproved published-total
comparison to the workflow's job summary. It does **not** upload or
commit CSV bytes, team/player names, raw fixture rows, replay sources,
or any source file artifact. The private temp directory is deleted
when the step exits. No GitHub token is passed to the HTTP request.

The hash is obtained **after** downloading the mutable provider file,
so it is NOT a previously trusted immutable source pin. Failure to
download, CSV schema changes or discrepant aggregate counts must be
investigated, not "fixed" by deleting checks. A successful workflow
does not clear upstream licensing, source completeness, source
independence, held-out calibration, M1 #31 or the M1 exit #3 audit.

## Fixed-seed parser regression corpus

`tests/m1-p5-reference-candidate-property.test.mjs`
independently recomputes club appearance ranges, duplicate directed
pairings, win/draw/loss categories and goals for 128 synthetic seeded
valid CSV cohorts. It then checks 96 deterministic malformed CSV
variants **with recomputed valid SHA-256 hashes** to ensure structural
validation does not accidentally rely on hash mismatches alone. Row
order, quoted ignored text and LF/CRLF input invariance are covered
without leaking venue fields into reports. These are finite parser
property/regression checks, **not** unbounded fuzzing, observed real
RPL matches, performance acceptance or statistical calibration.
