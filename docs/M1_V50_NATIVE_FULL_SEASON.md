# M1 P4 v50: full-size 240-fixture synthetic schema-6 history

**Research-only, 22 October 2026. Explicitly not a production M1 exit gate.**

The goal is to test the **maximum allowed 240 distinct fixture rows**
in genuine Chromium IndexedDB using existing schema-6 CAS, not to
repeat the previously completed v24 4096-seed deterministic corpus.

A disposable initial career uses the same 16-club synthetic catalog
and valid 240-match double-round-robin fixture IDs. Source-generating
v31 physically consistent match commands are admitted in chronological
synthetic fixture index, **sixteen at a time**. Fifteen existing
`commitM1V32PersistedBatch` calls generate exactly 240 rows.
Full replay/readback checkpoints at revisions 16,64,128,240 are recorded.
After actual browser navigation, the entire journal is replayed,
exported with v35 SHA-256, deleted from this **test-only** IndexedDB key,
restored add-only with its original immutable M0 and independently
replay-validated again.

The workflow records real browser/runtime metadata, source-generation
and commit wall time per batch, journal and archive character counts,
post-navigation replay time and restore/export time. No arbitrary
hard-coded latency threshold can make an uncalibrated game "PASS".
A failed 240-row experiment remains a P4 engineering finding.

**Fundamental limitation:** all 240 synthetic prematches are
independent, with no real intermatch fatigue, permanent injuries,
medical clearance, KDK sanctions or contingent player eligibility.
Therefore, even if 240 rows persist and replay, this is **not** a
playable career season or permission to pre-generate dependent matches.
A single fresh host profile is not a long-lived or eviction test.
No OS power loss, authenticated official referee evidence, third-party
rights clearance or statistical realism is established.

No production saved format, M0, engine, intermatch rules or model
parameters are changed. P3 #29, P4 #30, P5 #31 and exit #3 remain OPEN.
M2 remains prohibited.
