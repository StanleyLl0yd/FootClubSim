# M1 P4 v39: extended native Chromium schema-6 history profile

**Research-only, 22 October 2026. No production history or latency
acceptance criterion has been established.**

This incremental change extends the existing v36 native Chromium probe,
without touching domain logic or changing saved formats. The bounded
profile fixture count rises from **8 to 32**, and a pull request now
runs **16 real source-replayed fixture CAS transactions by default**.
The manual workflow can request 1..32. The browser profile remains
disposable, distinct from users' M0 or schema-6 data.

For every fixture the page measures source generation, end-to-end
IndexedDB read/validate/apply/commit, replayed readback and journal
character count. A real page navigation precedes a history validation,
v35 export and recovery of the disposable journal. Counts at later
revisions expose replay cost growth. The workflow prints the actual
measured values from that runner, not expected or invented performance.

## Explicit limitations

- The timing fields combine M0 loading, replay and database setup with
  transaction time; they are **not** pure IndexedDB lock lifetime or
  browser main-thread responsiveness/long-task attribution.
- The fixture sources are synthetic and uncalibrated. A 16- or
  32-fixture run does **not** demonstrate a 240-fixture production career.
- A fresh throwaway Chromium profile does not establish lifetime across
  days/months, cross-browser quotas, eviction, OS crash durability or
  cloud backup recovery.
- No automatic sports sanction, approved fatigue decay, verified
  medical clearance, primary referee authority or realism calibration.

M1 P3 #29, P4 #30, P5 #31 and M1 exit #3 remain OPEN. M2 prohibited.

## Observed native 16-fixture result (exact PR head)

[Hosted CI run 39746690494](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/39746690494)
at original v39 head `9a27384a5a1b54211f3c753cb0009c58c94919e6`,
Linux Ubuntu 24.04, HeadlessChrome 155:

| Checkpoint | End-to-end CAS | Full replay on load | Journal characters |
| --- | ---: | ---: | ---: |
| Revision 1 | 234 ms | 230.9 ms | 11,311 |
| Revision 8 | 1,606.6 ms | 1,598.3 ms | 89,164 |
| Revision 16 | 3,106.6 ms | 3,167.7 ms | 178,151 |

The runner measured 58,571.6 ms for initialization and all sixteen
source generations/commits/readbacks; post-navigation full replay took
3,387.3 ms, export 3,202.1 ms and add-only restore 6,303.9 ms.
The backup envelope contained 196,097 UTF-16 characters. The native
profile reported PASS. Each timing is a **single hosted observation**,
not a percentile, normalized CPU benchmark, isolated transaction-lock
time or release threshold.

Replay cost increased markedly as the journal grew. This creates a
concrete P4 concern for a full 240-fixture career; extrapolation from
16 synthetic fixtures would not justify a production SLA or a PASS.
Performance profiling and architectural remediation remain necessary.
