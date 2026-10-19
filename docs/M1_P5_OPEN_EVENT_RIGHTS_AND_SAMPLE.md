# M1 P5: source-rights and cross-league event sample (research only)

**2026-10-19 - NOT AN ACCEPTED RPL CALIBRATION SOURCE.**

## Authoritative source and reuse boundaries

Pappalardo and Massucco, [Events, Figshare, DOI
10.6084/m9.figshare.7770599](https://figshare.com/articles/dataset/Events/7770599)
(2019), explicitly label the **original event dataset CC BY 4.0**.
The related scientific description is [A public data set of spatio-temporal
match events in soccer competitions](https://www.nature.com/articles/s41597-019-0247-7).
The attribution must be retained if lawfully using that data.

The separately transformed GitHub repository
[`koenvo/wyscout-soccer-match-event-dataset`](https://github.com/koenvo/wyscout-soccer-match-event-dataset)
has **no repository-wide LICENSE** verified. Original Figshare CC BY does
not automatically certify a third party's transformed file, especially
without matching it back to the original bytes/events. FootClubSim
does **not** ship or ingest this data as a playable pack, source of real
2026/27 player names or approved commercial calibration baseline.

The original dataset includes **older European leagues and internationals**,
NOT the RPL 2023/24 or 2024/25. Rules, scoring, fouls, reporting,
competition, team strength and historical era vary. Do not transfer
probabilities to the simulated RPL without an explicit validated study.

## Exact one-match research specimen

The opt-in script `scripts/m1-p5-wyscout-open-events.mjs` examines a
single immutable *processed* sample (2016 France vs Romania, match
`1694390`) at:

- Git repository `koenvo/wyscout-soccer-match-event-dataset`
- commit `ebc4c54c1093c420a81ce442c69e4186fab33bb4`
- `processed/files/1694390.json`
- blob SHA-1 `a995bf83db3f2125811fbf16c03967bd924359eb`
- SHA-256 `17dc65f91cc70617bd45533dd6df9b1860397c8dc176ef506732a9af5ceaaa1b`
- original UTF-8 510012 bytes

Verified one-match observations from this exact file:
**1641** total events; **22** ordinary Shot events; **1** separate
Free Kick/Penalty attempt; **3** goal-tagged attacking attempts;
**3** duplicate goalkeeper Save attempt goal tags; **4** yellow-tagged
fouls; **0** direct-red and **0** second-yellow event tags.
`Shot` and `Free Kick/Penalty` must be distinguished; counting all
goal-tagged records indiscriminately would double-count three goals.
`xG` and medical injuries are **not supplied** in this specimen.

The script validates byte-exact SHA-256, JSON prototype integrity,
one match ID, registered teams, unique event IDs, bounded tags and
times, then reports **anonymized event counts only**. Synthetic tests
exercise goal-tag duplication, penalty semantics, cross-team forgeries,
cycles, getter execution and hash rejection. It does not infer goals
per match from these seven classes, generate cards, assess referees
or approve RPL calibration.

A workflow_dispatch-only manual research action stores the file only
in an ephemeral runner directory and outputs an aggregate step summary.
The manual action has not been run. No raw match/person data is committed
or uploaded as artifacts.

**Still required for P5 #31:** independently licensed current RPL
shots/cards/injuries/xG event references, rights review for any
transformed data used, pinned samples, a training/holdout design with
numeric pre-registered tolerances and broad deterministic diagnostics.
M1 exit #3 and M2 restrictions remain unchanged.
