# M1-P4 v26: atomic in-memory source replay of v23/v24 exposure

**20 October 2026. Experimental schema-5 domain journal; M1 remains OPEN.**

`src/core/m1-v26-exposure-journal.ts` composes the deterministic **one-match**
v23 result with v24 source-derived physical-seconds/discipline/treatment
projection. The original seed, prematch fixture and lineup, coaching policy,
half-time and in-play commands are retained as a bounded replay source with
the immutable catalog referenced through the initial career only.

Every untrusted prior schema-5 journal is independently JSON-preflighted and
**fully source-replayed**, including all earlier fixtures, before single or
1..16-request in-memory batch application. Each new fixture also replays
from its source and requires a full equal caller-asserted v24 result.
A mismatched seed, player seconds, modelled score, cards, treatment counts,
timeline-derived RNG state or tampered origin fails closed. Duplicate
commands/fixtures, wrong career, revision mismatch, non-calendar fixture,
wrong immutable catalog, forged JSON and partial batches are rejected
without exposing a partial updated journal.

The projected fixture facts include the actual deterministic model score,
physical playing seconds by player/team, shot/goal/card/withdrawal counters,
treatment exits/returns, substitutions, event count and seeded referee and
treatment RNG continuations. They are **not** official career state changes.
No fatigue formula, post-match condition, multi-fixture medical clearance,
KDK sanction, official points, financial posting or referee/medical authority
is inferred. Explicit `false` flags prevent those assumptions. The v23
events are synthetic, not independent evidence of a physical injury.

This is an **isolated pure transaction**, not a durable browser IndexedDB
CAS or upgrade/migration of existing M0/v3–v8 saves. There is no
cross-fixture eligibility continuity yet; a modelled injury/dismissal cannot
be treated as a confirmed future-match ban. Browser crash safety,
external source authenticity, league rules acceptance and two repository-wide
audit passes remain unverified.

Tests: `tests/m1-v26-exposure-journal.test.mjs` cover replay equality,
immutable catalog, malicious JSON, later-fixture atomic rejection, old
journal poisoning, stale/duplicate retries and explicitly untrusted claims.

M1-P3 #29, P4 #30, P5 #31 and exit audit #3 remain OPEN. Do not start M2.
