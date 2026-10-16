# M1 P3/P4: full v8 matchday-sheet sanction reconciliation

**2026-10-16, read-only consistency review. NOT a KDK source or automatic ban engine.**

`src/core/m1-v8-sanction-review.ts` builds on the new replay-validated
schema-4 v8 match journal and the existing explicitly fixture-scoped
confirmed-suspensions pre-match gate. It accepts only a caller-supplied
**authenticated and complete** authority snapshot; passing JSON
structure or a stable ruling ID is never evidence of KDK authority.

Unlike old v7 result journals that retain only *actual appearances*,
the v8 dossier carries the original full starting XI **and every
named substitute**, including completely unused bench participants.
For every retrospectively affected completed fixture the review now
distinguishes:

- previously listed **starter**;
- previously **used substitute**;
- previously named but **unused substitute**;
- genuinely **unlisted** registered person.

A confirmed retroactive ruling naming the first three produces an
explicit typed historical matchday-sheet conflict with fixture/person
IDs and exact listing kind, **without rewriting the already
committed match score or granting an automatic appeal**. A genuinely
unlisted person is not spuriously rejected for a fixture in which
they were not on the matchday sheet. A confirmed ban on the proposed
next fixture still blocks *either* XI or bench. The same fixture
cannot be replayed as a new prematch after it has been committed.

**External limitations:** the current gate only accepts complete
fixture-specific, explicitly enumerated suspension orders and has
no independently verified official decision issuer, effective date,
appeal, revocation, automatic yellow-card accumulation threshold,
real penalties, or guarantee of an exhaustive incoming feed.
The immutable journal can be replayed but **its input source is not
cryptographically authenticated**. Neither this module nor a changed
past ruling silently awards a fixture, changes results, derives
suspension length or validates retroactive KDK policy.

v7's cautious uncertainty when unused substitutes are not recorded
remains unchanged. M0/v3-v7 save formats and existing v8 journal
schema remain unchanged. M1-P3 #29, P4 #30 and exit #3 remain open;
M2 has not been authorized.
