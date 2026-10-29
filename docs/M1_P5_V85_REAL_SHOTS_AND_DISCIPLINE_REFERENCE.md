# M1 P5 v85 - independently observed 2025/26 RPL shots and discipline

An additional real season statistical reference, not a match-level
import: `data/rpl-2025-26-p5-shot-discipline-reference.json`.

Primary: [Спорт-Экспресс, Чемпионат России. Премьер-лига,
2025/2026, общая статистика](https://www.sport-express.ru/football/n/russia/premier/2025-2026/statistics/common/),
checked 29 October 2026. Its published table explicitly reports
**30 regular-season rounds × 8 matches = 240 games**, with **609
total-score goals**, matching the independently pinned v77 final
table. Short factual aggregates only are recorded; no full provider
table or individual match feed is redistributed.

| Observed season total | All 240 matches | Per match |
|---|---:|---:|
| Shot attempts | 5548 | 23.1167 |
| Shots on target | 1879 | 7.8292 |
| Goals (all types) | 609 | 2.5375 |
| Penalties recorded | 99 | 0.4125 |
| Scored penalties | 76 | 0.3167 |
| Fouls | 6815 | 28.3958 |
| Yellow cards | 1035 | 4.3125 |
| Red cards | 26 | 0.1083 |

Independent alternate provider:
[PerformanceOdds, Russia Premier League 2025/26
overall stats](https://www.performanceodds.com/league_stats_overall/14893/)
shows **5867 shots** across the same 240-match population
(24.4458/match) and the same 609 goals. The alternative total is
5.75% higher than the primary provider. We **do not merge or average**
the values. They remain two provider-defined reference totals until
the treatment of blocked shots, set pieces and exclusions is aligned.

For the frozen, exact-source v81 research corpus, modelled source
shot events were **24511 across 3840 full-time synthetic results**,
or **6.3831/match**. The real primary benchmark is about **3.62×**
higher (alternative about **3.83×**). Indeed the primary real
**on-target** count of 7.829 per match exceeds the model's full
6.383 source shot-event average. This gap strongly suggests that
**creating too few events**, not merely low scoring chance quality,
is a major realism problem.

However, the simulator's `kind:'shot'` event taxonomy must still
be audited against the providers' definitions before calling these
an exact statistical equivalence. P5 must report actual model
on-target shots, penalty-specific goals, cautions and red-card events
from a source replayed, calendar-balanced corpus, not fabricate them
from goals or modelled medical withdrawals. Real xG and verified
clinical injury data remain unspecified in this source.

Next: derive comparable model shot-on-target and disciplinary counters,
test sensitivity of the 18×300-second phase opportunity constraint,
predeclare and validate scoring/shot tolerances, then use the untouched
2024/25 holdout. No probabilities, production PRNG, saved event
schemas, M0 bundle, or existing v81 source experiment changed.
P5 #31 OPEN; P3 #29 OPEN; P4 #30 deferred; two full exit
audits #3 required. M1 OPEN, M2 prohibited.
