# M1 P5 v60: two-publisher RPL 2023/24 score comparison

Research only. Independent score-source consistency is not proof that a
simulated football match is realistic.

Footbolno publishes 240 completed league-235 matches for 2023/24 under
a CC BY 4.0 publisher claim. The hosted v59 audit recorded 238 matches
with at least one event; missing events are never interpreted as zero
cards. Only score outcomes are comparable here.

OpenFootball/europe is an independent historical score provider, pinned
to commit 63df627f3c87ce71708f016522ea236cf74332c3 and SHA-256
18512df8829a945f2b543a8ed5e8c3259e216263bc3e2a35c5545421d27b59cc.
Its one verified incorrect Sochi-Spartak score/home-away row is corrected
in memory by the previously tested 2023/24 inspector. Raw publisher bytes
are neither modified nor redistributed.

This v60 comparator rejects partial seasons, source impersonation,
corrupt counts and attempts to use the reserved 2024/25 holdout. It
reports eight complete-season outcome/goal-count deltas. Two different
sources need not agree; mismatches remain visible as evidence.

The opt-in PR research workflow obtains both sources in an ephemeral
runner, requires the exact pinned OpenFootball SHA-256, records the live
comparison in GitHub Actions job summary, then deletes all downloaded
files. It does not save raw events, player names, or source rows.

Publisher license claims are NOT independent verification of upstream
rights. Missing xG, advanced shots, exact disciplinary sanctions and
clinician-authenticated injuries remain unsupported. P3/P5 and M1 exit
remain open; M2 prohibited.
