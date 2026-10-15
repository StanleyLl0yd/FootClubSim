# M0 blockers: decision package and milestone scope boundaries

**Historical snapshot:** M0 subsequently closed on 2026-10-15 under [ADR-0010](adr/0010-m0-final-acceptance.md) and [exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2). Earlier pending M0 approvals below are superseded by that acceptance; M2/M3/release constraints remain open and M1 is not authorized.

**Final status, 2026-10-15:** The owner explicitly approved the three conditions to **close technical M0 after final exact-main CI** in [ADR-0010](adr/0010-m0-final-acceptance.md). The many 2026-10-14 unapproved options and steps below are preserved **historically**; they are **not current M0 owner blockers**. The actual Safari/real quota cases are NOT TESTED and tracked in [M2 pre-release #155](https://github.com/StanleyLl0yd/FootClubSim/issues/155). Original branding/real-data rights, registrations and full genuine effective RPL/IFAB execution remain **M2/M6** release gates. **M1 remains prohibited without separate permission.**

**Current owner decisions (2026-10-14):** the 16 club aliases, `Статика М1`/`Статика М2`, abstract three-ring badges and parody real-roster-prototype direction are now approved in [ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md). Any earlier unresolved choices for these exact names or city suffixes below are historical and superseded. Data licensing, actual player/coach status and M0 exit gates are still open.

**Status: PARTIALLY RESOLVED on 2026-10-14.** The owner has approved **all 16 exact club aliases**, the two distinct «Статика М1»/«Статика М2» labels, original three-ring badge designs, and the principle of real season-specific football/staff prototypes with original parody identities under **genuine RPL/RFU/IFAB rules**. These later decisions are authoritative in [ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md) and supersede the historical five-name status in ADR-0004. Fictional locality presentation (if needed), manager numeric details, source/rights and sporting-regulation verification, and M0-to-M2 save-testing allocation remain open. The **later** owner approval in ADR-0007 and refinement in ADR-0008 supersede the earlier D03-D05/D07-D11 proposals. This does not close #15 or authorize M1.


## Approved Bank of Russia FX source choice (2026-10-14)

The owner explicitly approved replacing Google Finance with the **official Bank of Russia daily XML FX service**, documented in [ADR-0009](adr/0009-rub-only-ledger-and-cbr-source-option.md). Source selection is no longer undecided. Once-daily immutable snapshot, RUB-only ledger rounded to 10,000 ₽ and all foreign-currency target conversions rounded to 1,000 units remain binding. Verified access from real browsers, applicable CBR source-reuse terms/attribution and actual M3 implementation are **not** implied by this source approval.

## D03-D05 and D07-D11 later owner approval (2026-10-14)

The owner explicitly accepted all eight architectural product decisions in [ADR-0007](adr/0007-match-tactics-multicurrency.md). D03/D05 include interactive in-match substitutions, changes in formation/tactics and individual instructions alongside deterministic automatic simulation. D07 originally used Google Finance as a proposed provider, **superseded by the explicitly approved Bank of Russia XML source in ADR-0009**. RUB-only accounting, six conversion directions and coarse rounding remain authoritative. Transaction and rights/access boundaries are specified there, **but the later [ADR-0008](adr/0008-online-daily-fx-rounding.md) supersedes its mandatory-offline and FX-refresh/rounding terms**: one locked daily quotation snapshot on first entry per real day (now using CBR), USD/EUR -> RUB rounded to **10,000 ₽**, and RUB -> USD/EUR to **1,000 units**. Internet access may be required. **The historical PENDING proposal text below is superseded by ADR-0007**; it no longer blocks the M0 product-choice gate. It does not resolve D13 numeric design, applicable league rules, FX acquisition/reuse licensing, browser test limitations, source clearance or the final two full repository audits.

## Owner-approved data/rules milestone split (2026-10-14)

[ADR-0006](adr/0006-m0-m2-acceptance-boundary.md) is accepted. M0 must finish original-synthetic-pack and provenance architecture, source/revision and official rule-edition references, an honest M0 rights/risk review and interface approvals. **Do not hold the M0 exit hostage to verifying all 16 October RPL registrations, assigning the 15 remaining clubs playable parodic personnel or implementing every real-RPL rule:** these are M2 gates, kept OPEN in [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91) and the M2 subset of [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15). This does not grant third-party licenses, declare exact sporting compliance or waive any M0 required audit or browser check. **D03-D05/D07-D11 were subsequently approved in ADR-0007**, and later CBR-only FX/RUB-ledger refinements are authoritative under ADR-0009; they are no longer open M0 product-choice questions. The separate proposed browser-test allocation below is **not** approved by this personnel/rules decision.

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
| D06 | **APPROVED league identity:** all 16 exact «Лига приколов» names and original three-ring badges are approved under [ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md). The 2026/27 RPL-inspired competition requires **genuine effective RPL/RFU/IFAB sporting rules** (30 rounds/240 fixtures), with full regulation and amendment verification still open. Do not silently replace genuine restrictions with fictional simplifications. | M2 season |
| D07 | Separate operating cash, commitments, salary and transfer budgets. Use bounded integer amounts in the declared currency and an auditable transaction ledger; no floating-point RUB finances. | M3 economy |
| D08 | Offer, negotiation, contract, medical/eligibility check and competition registration are different steps with atomic outcomes. Work can be personally managed or delegated per area, not globally. | M3 contracts/transfers |
| D09 | Each career pins data, generator, manager-profile, rules, engine and save versions. Invalid import cannot overwrite healthy saves; future revision changes are atomic and test migration/recovery. | M2+ persistence |
| D10 | M2 focuses on one complete season (plus the owner-approved profile wizard and minimal delegation); M4 adds rolling career, youth/regens, aging and promotions. No implied complete FM feature parity in M2. | M2 and M4 exits |
| D11 | Russian-first desktop-oriented browser UI, accessible keyboard/mouse, dense readable tables, explicit error diagnostics; local/offline data flow. | M2 UI/browser |
| D12 | **UPDATED APPROVED POLICY:** owner-approved parody player/staff identities inspired by **date-verified real 2026/27 prototypes**; only original club names, original geometric badges and project-authored gameplay ratings may appear in the new M2 catalog. Actual affiliation, date-of-birth, nationality, positions and staff roles need individual lawful evidence and provenance; source database redistribution, player publicity and trademark rights are **not** cleared. Current M0 remains synthetic, with zero source-derived playable facts. See [ADR-0005](adr/0005-liga-prikolov-brand-and-personnel.md) and [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91). | M0 source policy; each later data pack |
| D13-detail | Use distinct manager skills, same total preset/custom point budget, locally seeded chronological biographies and no hidden origin buffs. **Exact attribute names, number of points, scale and weights remain unapproved**, and can be frozen before M2 wizard implementation. | M2 manager creation; M3 gameplay effects |

The table is a **review proposal**. No row is accepted just because it
appears in the repository.

## The major dataset choice (historical alternatives, resolved by ADR-0004)

**Decision 2026-10-14:** the owner chose a fictional **«Лига приколов»** with inverse/antonym club names inspired by the 16 RPL 2026/27 participants, but with *actual real RPL sporting regulations*. This is **not** option C's authentic real roster. It uses an original fictional presentation plus an independently verified source-cited rules pack. The A/B/C options below are retained only as historical alternatives and **are no longer a decision request**. See [ADR-0004](adr/0004-liga-prikolov-rpl-rules.md).

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

**Resolved (2026-10-14):** all 16 reverse-name clubs, their disambiguating names and original abstract badges are approved in ADR-0005; the intended future roster uses original parody identities based on verified season-specific prototypes. Still pending are fictional locality display conventions (where applicable), precise interpretations and amendments of effective sporting rules, third-party source/brand/publicity rights, factual personnel verification and milestone exit gates. The A/B/C alternatives below are historical only. No third-party roster assets have been bundled in the M0 prototype.

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

1. Record only genuinely **remaining** M0 owner decisions: optional fictional locality display if required by the initial game design; precise M0 match/PRNG schema adoption and calibration-method contract; source/edition/original-brand risk acceptance; and unresolved native Safari/quota/eviction acceptance limits. D13 detailed manager numeric balance is M2, while the M0 version/skill-interface boundary still requires approval. **D03-D05/D07-D11, all 16 names, original badge concepts and roster-prototype direction are already approved** in ADR-0005/0007/0008/0009; do not reopen them. The personnel/rights/rules issue #15 stays open for its M2 gates.
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
