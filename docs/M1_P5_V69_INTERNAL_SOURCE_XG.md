# M1 P5 v69: exact internally sourced open-play xG, diagnostic only

The legacy v29 referee/medical match exposes source-derived shot and
goal counts but deliberately does not return per-shot xG in its v23
reconstructed event timeline. Its actual parent v8 match **does**
calculate per-shot xG in milli-units and sum it into each side's
verified `source.report.home/away.xgMilli`. v69 exposes these same
model-internal values ONLY through a new opt-in research diagnostic.

`inspectM1V29SourceOpenPlayXg` executes the unchanged full causal
v29 source engine once, receives the original v8 aggregate by a
separate trace object, and reconciles it with the exact v23 source
shot events and final goals. Its output is not appended to the normal
`simulateM1V29CausalMedical` schema, or to persisted career/
IndexedDB objects. Rejected simulations expose NO xG. The original
rejection diagnostic keeps its historical output unmodified.
No RNG draws, event order or tactics are modified.

The model-internal source xG is an expected-probability estimate
computed by FootClubSim itself. It is NOT observed sports data, not
independently validated xG, not a clinical injury statistic, and must
never be labelled a true-world RPL xG calibration. This diagnostic
allows research to distinguish engine-reported shot quality from
observed finishing without making up reference datasets.

The fixed hosted Linux research job inspects 32 seeds on one synthetic
fixture, conserves source shots, xG and realized goal counts, and
reports the aggregate. No third-party datasets or the reserved
2024/25 holdout are evaluated. Full CodeQL/Core/browser checks are
required before merge. P3/P5 and M1 exit remain OPEN. M2 prohibited.
