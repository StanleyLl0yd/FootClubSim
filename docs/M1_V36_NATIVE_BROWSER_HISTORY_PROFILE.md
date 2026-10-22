# M1 P4 v36: native browser schema-6 bounded history observation

**Development-only, 22 October 2026. No accepted production performance SLA.**

The browser experiment in `examples/m1-v36-native-history-profile.html`
posts **1-32 source-replayed v29/v31 fixtures** to a dedicated synthetic
v32/schema-6 career. It reports increasing-history measurements for each
`commitM1V32PersistedBatch`, full replay on a subsequent load, and
journal size in UTF-16 code units. A page navigation then tests genuine
IndexedDB persistence and measures final replay, v35 backup export and
add-only recovery of **only the disposable test journal**. The existing
immutable M0 career is preserved.

The separate, manually dispatchable workflow
`.github/workflows/m1-p4-v36-native-history-profile.yml` exercises real
hosted Chromium with a fresh browser profile and includes a small
pull-request smoke. The `fixtures` input is strictly bounded to 1..32. As of v39, the PR
smoke runs 16 fixtures (previous v36 evidence used 2); this is a
research-only scale-up rather than a production lifetime gate.
The report is printed in CI output and step summary, not committed
as immutable reference data: timing and user-agent depend on runner.

The measured commit time is **end-to-end API elapsed time**: M0 loading,
full replay, IndexedDB opening, its readwrite transaction and closing
are included. It is **not** isolated transaction-lock occupancy time,
nor a browser-main-thread long-task trace. No acceptable percentile,
240-fixture limit, crash/eviction recovery test, quota persistence
guarantee, source-verified league sanctions, clinical clearance or
fatigue calibration is established by this experiment.

Source formats, M0, schema-5 and schema-6 remain unchanged.
P3 #29, P4 #30, P5 #31 and M1 exit #3 stay OPEN; M2 prohibited.
