# M1 P5 v77: independent RPL 2025/26 final-results reference

**Reference is not calibration acceptance.** This narrow first external
fixture records *factual season-end aggregates*, not an imported match-level
database, proprietary shot feed, copyrighted article text or inferred xG.

- Primary: [Wikipedia, pinned revision 1380192814 (14 October 2026)](https://en.wikipedia.org/w/index.php?title=2025%E2%80%9326_Russian_Premier_League&oldid=1380192814).
  Attribution retained; the original Wikipedia page has its own licensing
  terms. Club season totals were transcribed as short factual numeric records.
- Independent table corroboration:
  [RSSSF, Russia 2025/26](https://www.rsssf.org/tablesr/rus2026.html).
  Its scores and records independently agree; no RSSSF article or full
  match-by-match dataset was copied.
- Verified on 29 October 2026. No 2024/25 holdout accessed.
- Source: `data/rpl-2025-26-p5-reference.json`.

**Reference population:** regular season only, 16 real teams × 30 games
/ 2 = **240 matches**; **609 total final-score goals** (2.5375/game);
**67 drawn matches** (27.9167%), **109 home wins** (45.4167%),
**64 away wins** (26.6667%), **15 final 0:0 matches** (6.25%).
The home/away split and 0:0 count were independently counted
from the pinned Wikipedia 16 × 16 Results score matrix and verified
against every club's season W/D/L/GF/GA. The 240 score rows are not
redistributed. Win and loss totals both 173;
team goals for/against both 609. The 2025/26 relegation play-offs
are **excluded**. Conservation tests check denominators and nonnegative
integer records, as well as absent metrics that must not be guessed.

**Newly comparable reference dimensions:** total final-score goals,
home/away/draw proportions and true final-score 0:0 share, once
equivalent synthetic final-score statistics are computed from a
source-replayed, properly sampled cohort. The existing v74
zero-**open-play**-goal count is not a final 0:0 count.

**Critical non-comparability:** `goalsAllTypes` includes all final-score
goals. Synthetic v74 `openPlayGoals` excludes explicit penalty/own-goal
contributions; direct comparison is invalid. No actual open-play goals, shots, shots on target, xG, cards or
injury counts is established by this reference. Those are explicit
`null` values, not 0. We do not fabricate independent estimates or
claim league realism from the internal model xG.

**Go/no-go:** reference structural and conservation integrity may pass.
Realism calibration must remain NOT ASSESSED until comparable metric
definitions, validated reference coverage, predeclared tolerance/CIs,
independent statistical treatment and generator performance gates exist.
Preserve original production RNG; use dispersed-seed sensitivity
diagnostics from v74 without treating them as actual league samples.

P5 #31 remains OPEN. P3 #29 OPEN. P4 #30 deferred.
Both full repository-wide exit audits #3 remain required; M1 OPEN,
M2 prohibited.
