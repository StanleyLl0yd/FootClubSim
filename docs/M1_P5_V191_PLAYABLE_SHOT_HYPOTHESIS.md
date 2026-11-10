# M1 P5: v191 shot-probability hypothesis in actual new careers

**Experimental, not release-accepted.** The 2025/26 development reference
(609 *all-type* RPL goals per 240 fixtures) differs materially from the
historical v188 four-source-replayed-season mean (896 open-play goals).
These categories are not exactly matched; no independent model validation
or source-data redistribution rights are implied.

This change reuses the existing **v104 joint-candidate B** parameter vector,
originally predeclared and run over **1,920 synthetic games** in
[the v106 measured report](M1_P5_V106_PINNED_JOINT_RESULTS.md):

| Versioned source | Shot opportunity | Open-play xG | Save probability |
| --- | ---: | ---: | ---: |
| Existing source 0 / version 1 | 1.00 | 1.00 | 1.00 |
| New source 2 (v191 hypothesis) | 1.08 | 0.60 | 0.68 |

The v103 100-second source now takes **strictly opt-in** parameters through
the already tested shot kernel. Its total 270 PRNG draws, real on-field
lineup and referee/medical transitions are unchanged. The v105 special-goal
chronology and v190 deterministic generated penalty/own-goal adapter use
the **same** explicitly versioned shot source during initial generation
and each candidate replay. No post-hoc rewriting or arbitrary mutation
of results is admitted.

Fresh browser careers select `specialGoalSourceVersion:2` at revision 0.
A started version-1 career remains on version 1, and a legacy v188 career
stays legacy. The canonical verification path binds the source-version
flag to full deterministic result re-generation and rejects mid-season
version changes and forged scores. Existing completed journals do not
receive new goal totals.

**Next required evidence before shipping as calibrated:** exact-head
Core/Docs/security and 240-fixture Chrome/Edge/Safari UI with roundtrip,
four or more independent full-season version-2 cohorts, shot/xG and
goal-source reconciliation, draw/home/away distribution, disciplinary
and injury attribution, holdout 2024/25 still sealed, and agreed
statistical tolerances and real-platform runtime. A multiplier's numerical
proximity in a v104 research generator is NOT sufficient to pass M1-P5.
