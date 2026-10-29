# M1 P5 v87: independent fixture × index seed control for synthetic referee decisions

## Why the existing 1920-result v86 corpus was a *seed sensitivity*, not a population rate

The v86 research used **the same 8 mapped seed values on each of
240 synthetic fixtures**. The internal v23 referee substream derives
its sequence from `rngSeed XOR M1_V23_COACH_DOMAIN_SALT`, independently
of the fixture ID. With identical starting lineups, the replayed
foul trigger, severity and sanction decisions can therefore
repeat **the same aggregate pattern for every match**, even though
which player is punished and the goal events differ.

In the completed [v86 16-shard exact-source workflow](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/40913042747),
all **1920/1920** replays succeeded, yielding per 8-seed group
exactly 24 first yellows, 1 second-yellow dismissal, 4 direct
reds, and 29 generated foul stoppages **for every one of the 240
fixtures**. Thus v86's apparent 0.5 direct reds/match is a **real
result of this reused eight-seed research design**, not a robust
estimate of the entire generator's probability distribution.

## v87 research plan, fixed before results

- The original v86 `runM1V86DisciplineSourceShard(group)`
  remains exactly its previous 8-seed shared input pattern by default;
  all v86 tests and reference interpretation remain valid.
- A new opt-in `fixture-domain-v87` mode derives a deterministic,
  SHA-256 first-32-bit **positive seed from the full tuple**:
  `FootClubSim-P5-v87-referee-fixture-separated-seed:<fixtureId>:<index>`.
- Every one of 240 fixtures gets **16 distinct independent mapped
  seed inputs**, for **3840** synthetic full-source replays, split into
  16 disjoint shards of 15 fixtures × 16 seeds.
- Reject any repeated mapped input seed within a shard; still preserve
  the generator's own original production RNG, referee thresholds,
  schema-6 source and saved journal format unchanged.
- Each shard records attempted, accepted and rejected counts; source
  shots, goals, first-yellow and second-yellow and direct-red
  dismissals, generated foul stoppages, events and withdrawals. A
  fixed rerun of the first shard checks deterministic core output
  excluding wall-clock performance observations.
- **All real-world source scopes remain distinct**: the real RPL
  2025/26 reference has 26 total reds/240 matches. Unaligned model
  generated stoppages are not all real fouls; model first-yellow
  semantics may not equal the provider's full yellow-card count.
  2024/25 holdout remains untouched.

The purpose is **isolating seed reuse** from generator rule
probabilities. It is not an approval to alter production RNG, silently
reroll a career match or weaken P3 referee/KDK/medical permission
checks. A statistically meaningful range needs larger diverse seed
populations, real definition alignment, declared release tolerances
and independent holdout evaluation.

P3 #29, P5 #31, two full exit audits #3 and M1 remain OPEN.
P4 #30 deferred. M2 prohibited.
