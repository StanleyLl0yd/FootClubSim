# M1 P5: independent original Figshare football-event research

**22 October 2026 - cross-league mechanical evidence only, NOT RPL calibration.**

## Source, attribution and scope

Original dataset, not a transformed GitHub mirror:

- Luca Pappalardo and Emanuele Massucco (2019),
  [Events, Figshare](https://figshare.com/articles/dataset/Events/7770599),
  DOI `10.6084/m9.figshare.7770599.v1`.
- The original publisher declares **Creative Commons Attribution 4.0**.
  Attribution above must accompany analytical reuse, subject to any
  additional upstream-rights review before public redistribution.
- The seven-competition archive contains 2017/18 European leagues and
  older international tournaments; **zero authentic RPL 2023/24,
  2024/25 or 2026/27 events**. Do not relabel this cross-league reference.
- Its event schema provides historical shots, penalties, free-kick shots,
  tags for yellow/direct-red/second-yellow and goal-tagged attacking
  actions. It **does not provide** authenticated RPL sanctions,
  medical diagnoses or a ready-made independent xG measure.

## Offline, reproducible extraction

`scripts/m1-p5-figshare-original-events.mjs` consumes a manually obtained
**original** `events_England.json` or another supported original event file,
not a derivative. It never connects to an API, scrapes, imports identities to
the game, or writes a raw-data fixture into the repository. Run from a local
checkout after `npm run build:core`:

```sh
node scripts/m1-p5-figshare-original-events.mjs --file=/private/events_England.json --competition=England --expected-matches=380
```

File size is bounded to 350 MB and event count to one million. The inspector
validates plain acyclic JSON, event and tag uniqueness, known event halves,
positive match/team IDs, finite phase seconds, and exact distinct-match
coverage. It reports only anonymous source-event-class *rates per match*,
sample standard deviations, analytical normal 95% intervals, and a Wilson
interval for matches containing a yellow-tagged event.

`--expected-matches` is a **caller-supplied claim**, not authenticated
coverage of every official 2017/18 fixture. The output includes the actual
local source SHA-256 and byte count to permit a subsequent repeatability
check. Until the output is compared to the publisher's original immutable
archive and the match index, the local file is **not self-authenticating**.
This script and its synthetic tests have NOT executed a real original
season dataset unless a separately recorded run proves it.

Wyscout `Shot` is reported as an ordinary source `Shot` event, not silently
equated to all open-play RPL shots. `Free Kick / Penalty` and
`Free kick shot` are separate. A goalkeeper `Save attempt` carrying the
same goal tag must not be counted again as an attacking goal. Observed
tagged action goals are **not** a full validated game scoreboard.
Shot-on-target, RPL rates, xG and clinical injuries remain `null`.

Existing single-match third-party transformation research is separate:
`docs/M1_P5_OPEN_EVENT_RIGHTS_AND_SAMPLE.md` makes no claim that
the derivative publisher rights were cleared.

This replaces neither RPL-specific source rights review, model matching
of refereed penalties and own goals, a preregistered holdout tolerance,
nor physical injuries and per-player exposure. No numerical realism gate
has been relaxed. #31 stays OPEN, M2 remains prohibited.
