# Wikipedia-first 2026/27 personnel research baseline (2026-10-14)

**Source policy:** Per owner instruction on 14 October 2026, begin prototype identification for all 16 «Лига приколов» clubs with **Wikipedia** for player identity, reported date of birth, citizenship, position, loan context, coaching, leadership and other publicly described roles. Use a **specific revision**, not a drifting current article, for reproducible research. Use official dated RFU/RPL/club documents selectively to adjudicate appearance, effective registration, transfer, loan, coach appointment and disciplinary conflicts. Wikipedia is a research starting point, **not** automatically the 14 October league eligibility authority.

This document changes **no** approved fictional name, badge, M0 synthetic career catalog, gameplay rating, save shape or M1 authorization.

## Three concrete Wikipedia revisions

| Source | Reviewed revision | Why this is useful | Why this does not close #91 |
| --- | --- | --- | --- |
| [2026/27 RPL club appearance lists](https://ru.wikipedia.org/w/index.php?title=Чемпионат_России_по_футболу_2026/2027_(составы)&oldid=155579206) | `155579206`, last edited **12 October 2026, 13:28** | Single article with a section for **all 16** approved club prototypes, reported nationality/DOB/playing positions, match appearances and coaching references | **Explicitly includes only people with at least one RPL appearance**. Unused registered players, inactive signings and certain youth/loan cases may be absent; older appearances do not prove continued October registration |
| [2026/27 RPL season](https://ru.wikipedia.org/w/index.php?title=Чемпионат_России_по_футболу_2026/2027&oldid=155571074) | `155571074`, last edited **12 October 2026, 05:53** | Independent 16-team participant, head-coach/captain and season coaching-change cross-check | Table contains temporal role claims; coaching replacements/acting roles require effective date checks, and this is not a club personnel registry |
| [Zenit club overview](https://ru.wikipedia.org/w/index.php?title=Зенит_(футбольный_клуб,_Санкт-Петербург)&oldid=155561861) | `155561861`, last edited **11 October 2026, 19:03** | First team vs second team vs youth, out-on-loan list, summer transfers, board and main-team coaches | Broad Wikipedia position labels, mutable team indexing and role duplication do not prove date-frozen RPL registration, eligible passports, medical/staff contracts or license clearance |

The [machine-readable, link-and-metadata-only source index](../data/drafts/liga-wikipedia-source-map-2026-10-14.json) maps all 16 approved **immutable** club IDs to their distinct headings in the shared RPL appearance article and pins these revision IDs. It records **zero** imported player rows and **zero** complete independently verified 14 October RPL registered rosters. [Negative tests](../tests/wikipedia-source-map.test.mjs) reject promoting an appearance-section or page lead into licensed, date-frozen playable records.

## «Надир»: distinctions revealed by Wikipedia

The approved [46-person fictional identity draft](../data/drafts/nadir-personnel-v1.json) includes **26 footballer identities**. The 11 October Zenit Wikipedia article displays **24 first-team footballers** in its main squad section, and separately places two of our approved **prototype targets** elsewhere:

- `lp-person-0004`, «Максим Зайкин» / **Максим Зайцев**, appears on the **«Зенит-2»** list.
- `lp-person-0018`, «Амир Музаев» / **Амир Мусаев**, appears in the **youth-team** list.

This is a **draft-to-source placement discrepancy**, not a deletion request or a proof that either footballer can or cannot play in the RPL. Preserve all 26 approved fictional identities. Their starting-team/registration status remains a separate, date-bounded field requiring actual evidence. Avoid a misleading equation “26 approved = 26 on the current RPL registration list.”

The main club Wikipedia page also has separate coaching and board sections; the article contains more or differently grouped roles than the owner's fixed **12 coaches + 2 board members + 6 support persons** in the 46-name fictional draft. In particular, it names some persons in more than one role, and separates first-team, Zenit-2 and youth coaches. **Do not merge persons or silently replace approved fictional IDs based on duplicated page labels.** Record each role with a team level, source revision and effective date independently. Do not infer missing doctors/security/administrators from silence.

Wikipedia broad groups also conflict with some of the creative draft's midfielder/attacker/defender categories (e.g. wingers), as already seen in the [RFU Cup grouping review](NADIR_RFS_CUP_CROSSCHECK.md). Research must separate `publishedGroup` from independently reviewed playing role(s) and from project-authored skill ratings.

## Material staffing changes surfaced by the dated season article

The season's 12 October revision reports date-sensitive management transitions that will matter when later writing other clubs' *fictional* trainer/board drafts, including changes at **«Родина» (8 October)** and **«Факел» (11 October)**, as well as September events at «Ростов». They are **leads**, not a copied staff table. Track the person, role, appointment interval, coach-vs-acting-coach distinction and independent dated match/club record before turning them into an as-of fictional staff role. For the [2 September RFU Cup match](DATED_MATCH_APPEARANCE_CROSSCHECK.md), Semak and Evseev are only documented for that **fixture date**.

## Content rights and boundaries

Wikipedia article **text** is generally [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with attribution and share-alike obligations for covered reuse. [Wikimedia's attribution guidance](https://attribution.wikimedia.org/attribution-signals/license.html) specifically treats images/media as having **separate file-specific terms**. The repository is public but proprietary, so **do not paste full article text, protected player tables, photographs, Wikipedia logo/crests or Wikipedia-derived expressive text into the game or repository** without a documented compatible rights plan. A basic fact cited to a source is not the same as redistributing an article, but the collection method, data/database rights (where applicable), player publicity and factual accuracy still need specific review. No automatic blanket permission is assumed.

Practical future provenance record per *candidate* person: `wikipediaRevisionId`, `sourceUrl`, `observedOn`, `factType`, `effectiveFrom/effectiveTo` (or unknown), `sourceSection`, `separateOfficialCrosscheckUrl` (when needed), `rightsReview`, and independent `fictionalPersonId`. No bulk scraping or automatic Wikipedia-to-playable-roster conversion is authorized.

**Outcome:** 16/16 club-section **Wikipedia research pointers**, **0/16 complete 2026-10-14 RPL registration datasets**, **0 independently cleared source-derived playable fact records**, **0 changes to the initial synthetic pack or current career saves**. Remain in M0 until [rights/rules #15](https://github.com/StanleyLl0yd/FootClubSim/issues/15), [roster work #91](https://github.com/StanleyLl0yd/FootClubSim/issues/91) and [two-pass M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2) gates are satisfied.
