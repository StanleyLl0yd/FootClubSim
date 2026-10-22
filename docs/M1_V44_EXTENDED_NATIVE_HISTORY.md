# M1 P4 v44: native 24-fixture schema-6 history observation

**Research-only, 22 October 2026. No production latency gate.**

The v39 native experiment tested 16 source-replayed synthetic matches
against real Chromium IndexedDB. The v41/v42 analysis isolated expensive
source replay from the write-lock interval. This dedicated workflow
extends history **to 24 distinct synthetic fixtures**, using the
unchanged v36 experimental browser page and v42 persistence layer.

The page measures actual end-to-end append CAS, source generation,
full replay of every growing journal, persisted journal size, and
post-navigation replay. It also exports a v35 backup, deletes **only
the disposable test schema-6 journal**, restores add-only, and proves
the original M0 source remains present. CI reports raw observations
including environment and limitations; values are never hardcoded into
a success assertion.

This 24-fixture fixture set is still a synthetic run, not a 240-fixture
full-season acceptance. A temporary new Chromium profile is not
long-lived storage or an eviction test. No validated production
percentile or memory/time threshold has been established. The
experiment does not test medical authorization, confirmed sanctions,
commercial source rights, or sports-model statistical calibration.

P3 #29, P4 #30, P5 #31 and M1 exit #3 OPEN; M2 prohibited.
