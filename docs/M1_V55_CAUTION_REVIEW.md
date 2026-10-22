# M1 P3: four distinct cautioned matches, source replay review (v55)

**22 October 2026. Model evidence only. NOT an authenticated RFU/RPL
suspension or clearance.** The Russian Football Union's
[RPL 2026/27 regulations, article 20.6](https://www.rfs.ru/subject/1/documents/preview?documentId=2164)
explicitly identify each fourth warning in different championship
matches as an automatic-disqualification category. The current
[RFU disciplinary regulations](https://www.rfs.ru/subject/1/documents?cat_id=59&mobile=no)
and any current rulings must take priority over guesses about red-card
durations, served fixtures, appeals, revocation and postponements.

`deriveM1V55CautionReview` validates the entire original schema-6
career journal with **full source match and player-exposure replay**.
It sorts fixtures by canonical *synthetic* round, not the order in
which results were committed. It counts `firstYellowCards===1` from
each already replay-validated physical fixture for each
`(teamId,playerId)` identity **only when that fixture has no
second-yellow or straight-red dismissal for the same player**.
Those mixed-card matches instead remain separate review-only signals
so a pair of YC leading to dismissal can never be mistaken for
two simple accumulated cautions. The count is of **distinct source
fixtures with uncomplicated caution evidence**. At cumulative 4, 8, ... it emits an internal
`fourthDistinctCautionReviewSignal` and the next synthetic scheduled
round fixture to *review*, not to unilaterally ban participation.
Cases of a second-yellow or straight-red dismissal in the same
fixture are explicitly marked `excludedFromSimpleCautionThreshold`
rather than silently counted toward the next four distinct
uncomplicated warnings. This is conservative and might undercount
real-world sanctions until official adjudication.

The read-only `laterMatchdayListings` scans both original starting
XI and **complete named bench**, including unused substitutes with
zero physical exposure, in later source-verified matches. This is
important because merely counting physical appearances misses the
named matchday bench. Each warning contains the actual original
fixture ID, round, committed revision, club, player and physical
seconds. It does not retrospectively rewrite scores, invalidate
otherwise accepted source journals, or invent served matches.

The report unconditionally asserts:
`externallyAuthenticatedRplDiscipline:false`,
`servedMatchOrAppealStatusKnown:false`,
`automaticEligibilityAllowed:false`,
`calibratedDisciplineRate:false`.

The **fourth warning count is not a legal four-card ban**. The source
simulation does not know whether a first yellow counts under the
specific competition, how second-yellow dismissal is treated, whether
a ban was already served, whether sanctions were carried over,
suspended conditionally, appealed or cancelled, or whether
postponements changed the real fixture order. A separate trusted
authority adapter and current official complete disciplinary state
are still required for P3 eligibility enforcement. Never use an
untrusted empty list as proof of eligibility.

Adversarial tests cover inverse posting order, four distinct
synthetic fixtures, later matchday starting presence, forged card
counters, asserted authority and malicious source getters. No
external-person or 2026/27 RPL data is collected.

M0, historical match outputs and journal schema remain unchanged.
P3 #29, P5 #31, P4 #30 and exit #3 remain open, and M2 is forbidden.
