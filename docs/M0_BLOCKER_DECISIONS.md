# M0 blockers: decision package and milestone scope boundaries

**Status: PROPOSED, awaiting owner sign-off. Prepared 2026-10-14.**
This document **does not accept D03-D12** on behalf of the owner, create
redistribution rights, clear issue #15, finish either whole-repo audit pass,
or authorize M1. The owner previously accepted only D01/D02 and the core
D13 manager-origin/biography requirement.

## Principle: separate M0 architecture exit from gameplay release

M0's purpose is to freeze **interfaces, constraints, sources, milestones and
test obligations**, and deliver the already verified synthetic prototype.
Actual management gameplay, match generation, changing career saves and
authentic released 2026/27 RPL behavior have **later acceptance gates**.

Proposal: require verified **source-reference contracts** and a risk register
during M0, but do not pretend the implementation, live browser quota eviction,
complete season playthrough or externally calibrated match distributions have
already happened. They should become explicit **blocking gates at M1/M2/M3**
when the corresponding feature exists, rather than being silently ticked off
in M0. Re-scoping a current M0 checkbox still requires owner consent and a
dated acceptance update; the current open checkboxes remain open until then.

## Owner product decisions requiring response

| ID | Proposed resolution to accept or revise | Future validation boundary |
| --- | --- | --- |
| D03 | All clubs use one headless, event-ledger-based seeded simulator. No forced animated match viewing. A future tactical assistant can be delegated separately, without score shortcuts. | M1 event generator; M2 season/UX |
| D04 | Keep original, synthetic **33 player attributes**, integers 1-100 for the first version. Separate potential, form, condition and manager skills; version future changes rather than silently modifying saves. | M1 weights; M3 development |
| D05 | First layer: formation, XI/bench, mentality, pressing, compactness, defensive line, passing risk and tempo. Additional role/individual tactics remain extendable. No guaranteed wins from tactical controls. | M1 effects; M2 working controls |
| D06 | First season: a 16-club, 30-round, 240-fixture home/away competition. **Source-rights option (A/B/C) remains undecided**; not every fictional test league is authentic RPL. Use a reviewed, separately versioned competition rules pack and separate genuine RPL nuances from intentional synthetic simplifications. | M2 season |
| D07 | Separate operating cash, commitments, salary and transfer budgets. Use bounded integer amounts in the declared currency and an auditable transaction ledger; no floating-point RUB finances. | M3 economy |
| D08 | Offer, negotiation, contract, medical/eligibility check and competition registration are different steps with atomic outcomes. Work can be personally managed or delegated per area, not globally. | M3 contracts/transfers |
| D09 | Each career pins data, generator, manager-profile, rules, engine and save versions. Invalid import cannot overwrite healthy saves; future revision changes are atomic and test migration/recovery. | M2+ persistence |
| D10 | M2 focuses on one complete season (plus the owner-approved profile wizard and minimal delegation); M4 adds rolling career, youth/regens, aging and promotions. No implied complete FM feature parity in M2. | M2 and M4 exits |
| D11 | Russian-first desktop-oriented browser UI, accessible keyboard/mouse, dense readable tables, explicit error diagnostics; local/offline data flow. | M2 UI/browser |
| D12 | **Preferred initial safe scope:** distribute only authored fictional players, clubs, backgrounds and artwork, while using official rules **as researched source references**, not copying protected PDFs or databases. Introduce any real club roster/name/mark/photo material only after field-by-field rights evidence and release review. Public web access is not a license. | M0 source policy; each later data pack |
| D13-detail | Use distinct manager skills, same total preset/custom point budget, locally seeded chronological biographies and no hidden origin buffs. **Exact attribute names, number of points, scale and weights remain unapproved**, and can be frozen before M2 wizard implementation. | M2 manager creation; M3 gameplay effects |

The table is a **review proposal**. No row is accepted just because it
appears in the repository.

## The major dataset choice

**Option A (recommended for a safe first playable M2):**
a wholly fictional 16-club league, fictional players and original labels.
Model the same **structural** 16 x 30 competition and the separately
documented rule behaviors that have been genuinely verified. The game must
call this a fictional league, not claim it is the official 2026/27 RPL.
Keep a modular, dated **RPL rules source-reference model** for a later
rights-cleared real pack. Fictional data avoids unauthorized roster/artwork
distribution but does **not** remove the need to verify the rules we
claim to implement.

**Option B (hybrid, requires separate approval):** real club
**names as independently sourced facts**, but entirely fictional players,
staff, careers, fixtures and logos (or none). This can retain geographic
identity without bundling a copied real roster. A neutral name reference,
club trademarks and implied official league affiliation raise **different**
legal issues; verify the allowed product presentation and naming rights
before bundling or claiming endorsement. Never market a synthetic roster
as authentic 2026/27 RPL data.

**Option C (authentic real RPL as the first playable league):**
real club identities, squads, registrations, dates and branding require
a **field-level, use-case-specific rights assessment**. Plain
football facts, licensed structured data and trademarks have distinct
legal implications and must not be conflated. Do not presume every real
club name is automatically prohibited; equally, factual public access
does not license an entire proprietary roster database, portraits or
badges in an offline client pack. Collect only by permitted methods.
If real records cannot be verified, the feature stays blocked or reverts
to a clearly labeled fictional scope with owner approval. Accurate live
RPL eligibility/discipline and amendments additionally demand legal
and sporting-rules review.

**Possible structured-data source for B/C:** Wikidata declares its
own structured database under [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).
This can be investigated for independently reusable **facts** and stable
club/person references, but its licenses do not automatically apply to
external webpages, linked photographs or emblems. Check each material
source, personal-data issue, trademark presentation and the accuracy of
current-season registrations before inclusion. Wikidata is **not** a
pre-verified complete 2026/27 player roster.

**Decision required:** choose A (all fictional), B (real team names,
synthetic rosters and separate identity/mark approval) or C (authentic
rights-cleared league); record its explicit source, rights and milestone
acceptance gates.
No bundled third-party assets are present in the current M0 prototype.

## Confirmed source-specific rule contracts (not a full review)

On 2026-10-14, the RFU official publication list still identified the
**25 June 2026** main RPL regulations. Independently inspect the
[primary PDF](https://www.rfs.ru/subject/1/documents/preview?documentId=2164)
and cross-reference the maintained [M0 rules matrix](M0_RPL_RULES_MATRIX.md).

- **Article 5.8, PDF p.18:** main list 3A max 25; max 12 foreigners
  there/combined lists 3A+3B, with **max seven concurrently on field**;
  a homegrown quota with separate club and association categories and
  penalties for shortfall; lists 3B/3C have additional age/size bounds,
  two goalkeepers in 3A+3B, RPL-club loan constraints. Exact eligibility
  must use the source definition of a foreigner; passport nationality is
  not a complete substitute. The current M0 `maxForeignersOnField:7`
  rule is only a minimal **synthetic** validator, not full article-5.8
  implementation.
- **Article 18, PDF p.47:** three points/win, one/draw; head-to-head
  comparison precedes total wins, goal difference and goals; subsequent
  away results and disciplinary points matter. Head-to-head is skipped
  for relevant tied clubs if the provisional table lacks an equal count
  of their mutual matches. Full deadlock has **different** methods for
  interim ranking (previous season) vs final ranking (extra game/tournament).
  Neither case should be silently determined alphabetically.
- **Articles 5.6.2 and 10.12, PDF pp.17/31:** registered coaches have
  their own role, qualification and authority constraints. The
  manager's **fictional** practical/theoretical profile does not by
  itself certify eligibility to act as a real-world RPL head coach.
  In the game, manager background and appointing an eligible named
  head coach/official are different concepts; authority/duties
  delegation must reflect this where a licensed rules pack applies.
- **July 2026 RFU disciplinary/player-status documents** and
  **2026/27 IFAB rules** are separate source dependencies. Individual
  sanctions, transfers and substitutions require article-level
  verification before executable behavior is called official.

This is only a **checked subset** from selected pages and official
document indexes, not proof that all amendments, appendices and related
RFU regulations have been reviewed. Retain [issue #15](https://github.com/StanleyLl0yd/FootClubSim/issues/15)
OPEN while these are unresolved.

## Browser/save tests: proposed reallocation without falsifying status

M0 currently proves an add-only revision-0 career save and
import/export/reload in native Safari, Windows Chrome/Edge and Linux
Chromium. Windows Chrome Incognito and Edge InPrivate have additionally
confirmed separate real browser contexts and intra-session recovery.
M0 also exercises mocked/injected IndexedDB quota failures, but
**not actual quota exhaustion, eviction, private Safari, or migration
of evolving career records**.

Proposed split requiring owner acceptance:
- **M0:** maintain actual normal-browser cross-platform initial-save smoke,
  negative import/storage tests, typed quota failures and an honest
  limitations/backup notice.
- **M2 gate before declaring saves production-ready:** real storage
  quota/eviction, Safari Private Browsing as feasible on supported
  hardware, browser shutdown/restart scenarios, atomic revision
  recovery and save-schema migration. If an environment cannot test an
  exact private-mode configuration automatically, record a reproducible
  manual acceptance path and **do not** claim the test ran.
- **M4+ gate:** multi-season migrations and recovery across large save
  histories, with actual retention/performance measurements.

This division is not a retroactive test pass. It clarifies where
unimplemented gameplay persistence can actually be observed.

## Exit process remaining

1. Record the owner's **specific response** for D03-D12, D13 detail,
   data option A/B/C and M0-vs-M2 save-testing gates. Update ADRs and
   implementation issues after approval, leaving undecided points open.
2. Finish source/rights policy decision. Source **identification** and
   release rights are different; preserve the factual status of #15.
3. Run the **first full source-by-source repo audit** after design
   sign-off, implement only justified refactors and document reasons
   for deliberately unchanged components.
4. Revisit every file **again** in the mandatory second pass on the
   corrected revision. Run final-main browser, security, dependency,
   build, type and unit checks; record before/after metrics with
   a consistent Git-index method.
5. Only when every owner-approved M0 criterion passes: close exit
   [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2),
   report **M0 COMPLETE**, and **STOP before M1**. Do not start M1
   without an explicit separate instruction.
