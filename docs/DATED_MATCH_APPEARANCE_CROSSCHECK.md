# Date-bounded match appearances: first two-club cross-check (2026-10-14)

**M0 research only.** Four distinct, dated, **completed** 2026/27 matches corroborate participation for «Надир» (FC Zenit), «Зеленобер» (FC Krasnodar), and «Статика М2» (Dinamo Makhachkala). **No** full RPL registration list has been verified for any of the 16 clubs. The record [`data/drafts/liga-dated-match-observations-2026-10-14.json`](../data/drafts/liga-dated-match-observations-2026-10-14.json) stores aggregate measurements and two narrowly chosen observations, **not** the official source tables.

## Dated source comparisons

| Evidence | Club(s) observed | Narrow finding |
| --- | --- | --- |
| [RFU Cup official completed protocol, 2 Sep 2026](https://www.rfs.ru/cup/tournament/match/57200) | Зенит; Динамо Махачкала | Both started 11 and entered 5 replacements (16 distinct participants each). The protocol also lists 11 unused/used bench **places** on each team; bench places are **not** individual October RPL registrations. |
| [Krasnodar official club report, 10 Oct 2026](https://www.fckrasnodar.ru/team/news/object/?object_id=154192) | Краснодар; Зенит | Краснодар fielded 11 starters plus 5 replacements (16 distinct participants). Зенит fielded 11 starters plus 3 replacements (14 distinct participants). The source is an **opponent club's match report**, not a signed RPL 2026-10-14 registration list. |\n| [Lokomotiv club report, 10 Oct 2026](https://www.fclm.ru/news/n/fakel-lokomotiv-rpl-2026-27-match-summary/) | Факел; Локомотив | Факел 11 starters + 4 replacements (15 distinct participants); Локомотив 11 + 5 (16). Dated club match report, **not** a league registration index. |\n| [RFU Cup completed protocol, 13 Oct 2026](https://www.rfs.ru/cup/tournament/match/57213?TournamentMatchesFilter%5BtournamentId%5D=1209) | Локомотив; Акрон | 11 starters + 5 replacements (16 participants) **each**. Penalty shootout is excluded from extra on-field participation counts. |

The numeric participant aggregates were manually derived from the published match records. They **do not sum into a league or club roster denominator** because different fixtures can overlap, exclude unused squad members, use youth players, or have changing club registration. A full registration list could have many more names than any one day's match participants.

## Targeted individual checks (no bulk roster copying)

- **Артём Карпукас** appeared as a **substitute** for «Зенит» in the 2 Sep [RFU protocol](https://www.rfs.ru/cup/tournament/match/57200) and was named in the **starting XI** for the 10 Oct [RPL club report](https://www.fckrasnodar.ru/team/news/object/?object_id=154192). This independently bolsters the already recorded summer transfer lead. His previously assigned original *fictional person ID* `lp-person-0020` is retained as a research pointer. Neither appearance alone establishes registration, uninterrupted employment, contract, passports or availability on 14 Oct.
- **Сергей Семак** is identified as FC Zenit head coach in the **2 Sep** RFU match protocol. This is a dated September staff-role attribution, not a complete effective Oct 14 staff appointment or coaching license verification. The approved original `lp-person-0027` remains an identity-only draft.
- The 2 Sep protocol names **Вадим Евсеев** as the Dinamo Makhachkala head coach. This is a research clue for the not-yet-authored «Статика М2» personnel roster; no fictional ID or role fact was imported.


## Source discrepancy resolved before computing 13 October counts

The [Lokomotiv club report of 13 October](https://www.fclm.ru/news/n/lokomotiv-akron-cup-2026-27-match-summary/) abbreviates **Никита Базилевский (64)** without stating the incoming substitute's name, while the [RFU official match record](https://www.rfs.ru/cup/tournament/match/57213?TournamentMatchesFilter%5BtournamentId%5D=1209) explicitly shows **Артём Сидоренко** entering for Базилевский in minute 64. This is a concrete source-quality example: treating the shorter club summary as a complete substitutions ledger would undercount «Акрон» by one. The official match protocol (11 + 5 = 16) controls **only** this bounded match appearance count; it still does not establish the club's entire October RPL registration list. No full lineup or protected source article is reproduced here.
\n## Methodology / rights guardrails

1. Save source URL, provider, actual fixture date, competition, record status, club IDs, numeric participants and a **minimal targeted case**; avoid copying the underlying complete lineup/staff table, all person identifiers, face photos or logos.
2. Match `fictionalClubId` against the independently approved 16-club register and case `fictionalPersonId` against the approved «Надир» ID draft. An automated structural validator checks provenance declarations, temporal bounds, unique fixture/case IDs and count identities. It **cannot** independently verify source authenticity, match events or legal rights.
3. Treat three separate predicates as different: (a) **appeared on a specific date**; (b) **was listed in a bench or team index**; (c) **was legally registered and eligible in a date-frozen RPL roster**. Only (a) was measured here. Do not promote one to another.
4. The [mutable Cup index review](NADIR_RFS_CUP_CROSSCHECK.md) already identified three stale memberships. Never use the Cup index as an October league roster. Do not infer a club's total population from distinct participants in one or two games.
5. No external data redistribution rights, publication/publicity or coach employment permissions are established; zero source-derived playable facts. The original M0 synthetic pack, approved draft identities and revision-0 career saves are unchanged.

**Next steps:** obtain effective 2026-10-14 RPL/RFU registration list(s) under compatible collection/redistribution rights, reconcile the named departures/transfers and unused/academy players, and separately verify support personnel. Continue with «Зеленобер» and other 14 clubs using only dated, licensed source material. Relevant open gates: [#91](https://github.com/StanleyLl0yd/FootClubSim/issues/91), [#15](https://github.com/StanleyLl0yd/FootClubSim/issues/15), [#2](https://github.com/StanleyLl0yd/FootClubSim/issues/2).
