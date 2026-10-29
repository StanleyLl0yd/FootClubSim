# M1 P3 v72: historical modelled-withdrawal eligibility regression

The v63 admission gate must not accept an altered historical career simply
because the formerly withdrawn player is no longer on the **current**
fixture list. Existing source-replayed schema-6 history is re-evaluated
from the original M0 career catalog every time.

This regression builds a real persisted-shaped (in-memory) v32 source
journal with a modelled permanent withdrawal in round one, then posts
a later *individually verified* round-two match that improperly names
the still-held player. Two attempts are tested separately:
(1) in the later starting XI and (2) in the later named but unused bench.
Both records pass the low-level isolated source-journal replay, but the
v63 cross-fixture medical gate for round three MUST reject each as
`HISTORICAL_UNRESOLVED_MEDICAL_CONFLICT`, identify the offending
fixture/team/player, and leave the input journal unchanged.

This is a new adversarial negative acceptance test, **not** new medical
clearance authority or verified real-world diagnosis. The production
engine, v63 contract, save schema, RNG, CAS and original rosters are
unchanged. Deliberately crafted invalid histories remain representable
in the lower-level source journal so that the higher-level admission
gate explicitly detects them. No fixtures or 2024/25 holdout data
from real-world sports are used.

P3 remains OPEN pending trusted clinician/referee adjudication, applicable
IFAB exceptions and authenticated KDK sanctions. P4 deferred; P5 and
M1 exit audit remain OPEN, M2 prohibited.
