# M1 P3-4 / P5-5 full native 240-fixture observation

This is a **separate dependent acceptance-evidence attempt**, NOT a
new milestone, formal P3-4 completion or release-performance pass.
It runs the source of PR #464 through **240 real sequential
IndexedDB readwrite CAS commits**, requiring all 16 clubs and 30
matchdays (30 selected-club, 210 opponent-only fixtures).

After **real page navigation**, it independently reloads and fully
replays the exact 240 match sources, checks no 241st fixture, verifies
untouched M0 and records wall-clock, maximum single-fixture prepare
and commit, journal byte size, replay latency and browser version.
A missing legal XI, unhandled source or performance timeout is a
**real failure and blocker**, not an eligible skipped case. A 45-minute
CI limit is a safety cap, **not a promised user SLA**.

The workflow tests Linux native Chromium first. Windows Chrome/Edge,
macOS Safari full-season, explicit quota/eviction/interruption and
predeclared accepted budgets remain mandatory P5-5 gaps. Modelled
fictional cards/medical are neither KDK nor clinical authority.
No 2024/25 holdout access. P3/P5 gates remain 0/9 ACCEPTED.

## Observed performance failure and bounded correction

The original exact-head native run reached **64/240** after 35 minutes;
its maximum per-fixture IndexedDB commit took **42,164 ms**. Replaying the
entire already-verified source prefix on every prepare and again on every
CAS made the full-season cost approximately quadratic. This is a REAL
failed P3-4/P5-5 gate, not a missing-data exemption.

The v188 source now maintains a **bounded, process-local, exact-byte
validated-prefix cache** of at most two careers, bound to the complete
initial M0 snapshot and full journal byte string. No fuzzy checksums,
persisted trust flags, network attestation or external actor authority.
Unknown/modified/corrupt bytes are always fully replayed and still fail
closed. Every newly committed source is strictly verified once before
memoizing its entire prefix. After actual browser restart the cache is
empty and full source replay remains required before use. Both new
anti-tamper unit tests and the complete native 240-match case are required
to validate this correction; preliminary performance is NOT acceptance.

### Security review: no mutable calendar aliases in the replay cache

The memoized prefix contains only exact initial/journal strings and copies
of fictional eligibility holds. It never retains the mutable fixture list.
Every successful cache hit derives a fresh 240-fixture calendar from the
validated immutable initial pack. A caller can mutate a prepared fixture
object in JavaScript, but cannot affect the next prepare or native CAS
validation: forged fixture IDs and home teams must fail with
`WRONG_FIXTURE` while the correct original is still admissible. This
negative test is mandatory before merging the optimization.

## 195/240 observed lineup failure — explicit fictional sanctions

Second native run on older exact HEAD `e3fbf63d9c458769b7423fd1fbc6107d58cbd585` reached fixture index **195** and then failed `NO_LEGAL_LINEUP` ([job 125823052193](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/41608148533/job/125823052193)). Its prior indefinite hold for **every** generated direct red or second yellow could exhaust a team's 23-player synthetic registered roster. The original 64/240 result had a distinct replay cost failure; neither was a 240-match PASS.

This correction introduces **fictional league baseline only**, not an RFU/KDK ruling: direct red excludes an identified player from the next **three completed club fixtures**; an in-match second yellow excludes for **one next club fixture**. Fictional modelled injury withdrawals still exclude for the source-deterministic 1–4 future club fixtures. These are explicit synthetic game-world policies, not inferred official bans or clinical discharge. Official orders/appeals and unresolved KDK decisions remain **unsupported and unapproved** (the existing evidence flags stay false); no external sanction or medical source is imported. The next match's XI/bench is regenerated from the resulting source-bound holds; expiry is counted by that player's **own club fixtures**, not a global fixture count.

The native Chromium runner now throws immediately when the page reports its authoritative `_FAIL` marker, instead of swallowing that marker inside a general CDP-retry loop and misreporting a 35-minute timeout. The **35-minute safety cap and exact 240-fixture acceptance target are unchanged**. This is a hypothesis-based repair requiring the complete new HEAD CI/real-browser run; it is NOT an accepted P3-3 suspension lifecycle, KDK/legal compliance or P5-5 budget.
