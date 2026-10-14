# ADR-0004: Liga Prikolov with genuine RPL sporting regulations and fictional reverse-name clubs

**Status: Core product direction ACCEPTED by owner on 2026-10-14.**
**The sixteen exact club names below are creative candidates, NOT approved
names or a ready-to-ship catalog.** Neither official RPL regulatory completeness
nor external branding/source rights are declared satisfied.

## Owner-approved direction

1. The playable fictional championship is named **«Лига приколов»**.
   It is a parody/alternative football world inspired by the Russian
   Premier League, **not** an officially sanctioned RPL competition. Do
   not claim any affiliation or endorsement in the UI.
2. Its playing, roster-registration, substitution, discipline, standings,
   foreigner, eligibility, season and relevant sporting restrictions must
   be **derived from actual effective RPL/RFU regulations and applicable
   IFAB Laws**, not made up as convenient league rules. Freeze and version
   the verified source editions for a career. Any unavoidable unsupported
   edge case remains an explicit rules-pack blocker, not a quietly
   implemented approximation advertised as official.
3. Base the **sixteen** first-season fictional clubs on the teams actually
   participating in RPL 2026/27, but invent each club's **public-facing
   name by antonym, semantic reversal or deliberate wordplay** on the
   real name. If a source name is a proper noun, city or acronym with no
   true antonym, do not falsely label the reversal a dictionary antonym.
4. Use **original fictional footballers, staff, biographies, badges and
   visual identities** rather than silently copying real rosters, real
   club insignia or player images. Exact future squad generation and
   original artwork need their own reviewed designs and rights gates.
5. Keep **regulations and the roster/branding pack independently
   versioned**: real sports rules may govern a fictional league without
   distributing original real-world player databases. Ensure the game
   distinguishes source identity, the fictional display name and stable
   internal club ID. Existing M0 revision-0 synthetic saves are not
   silently renamed or migrated.
6. The league follows the verified participant/competition rules
   **for the selected season snapshot**. An actual later sporting
   amendment needs a new reviewed rules-pack version; an existing
   career's identities, standings and rules never change automatically.
7. The owner-approved three-origin manager creation and granular staff
   delegation rules remain intact. Staff/manager backgrounds do not
   bypass actual RPL coaching accreditation or registration requirements
   where a specific playable rules-pack model requires them.

## 2026/27 source-team mapping: candidate club names only

The current participant list comes from the club-published [2026/27 RPL
participant list](https://www.fc-akhmat.ru/news/press/vse-uchastniki-rpl-v-sezone-202627/),
cross-checked against the RFU [2026/27 RPL Cup fixture announcement](https://www.rfs.ru/news/224573) and competition's official regulation
[PDF documentId 2164](https://www.rfs.ru/subject/1/documents/preview?documentId=2164).
The real names below are **source references for the parody**, not
licensed game data, and are not actual in-game club records today.

| Real participating club | Proposed fictional display name | Transformation class | Rationale |
| --- | --- | --- | --- |
| Зенит | Надир | Direct antonym | Upper celestial point vs lower |
| Краснодар | Зеленозабор | Compound wordplay | Red -> green, give -> take; `забор` also humorously suggests a fence |
| Локомотив | Вагон | Role reversal | Pulling engine vs hauled carriage |
| Спартак (Москва) | Патриций | Historical inversion | Gladiator/slave leader vs Roman aristocrat |
| ЦСКА | ОГКМ | Acronym inversion | Окраинный гражданский клуб мира vs Центральный спортивный клуб армии; playful, not a literal 1:1 acronym |
| Балтика | Пацифика | Geographic contrast | Baltic inland/European sea vs vast distant Pacific |
| Динамо (Москва) | Статика-Москва | Direct antonym | Dynamics vs statics, retain geographical distinction |
| Рубин | Уголь | Value/color contrast | Valuable red stone vs ordinary black carbon |
| Ахмат | Упрёк | Name-meaning wordplay | Praise-worthy name vs reproach; **not** a literal antonym of a person's name |
| Ростов | Спадов | Stem antonym | Рост vs спад, retaining a place-name-like form |
| Крылья Советов | Корни Запретов | Dual inversion | Wings vs roots; advice vs prohibitions |
| Оренбург | Оренсело | Compound suffix contrast | `бург` town/fortress vs village; `Орен` has no dictionary opposite |
| Акрон | Подножье | Loose semantic contrast | Evokes high point/peak vs foot of a mountain; not a verified etymology of the commercial club brand |
| Динамо (Махачкала) | Статика-Махачкала | Direct antonym | Dynamics vs statics, geographic distinction |
| Родина | Чужбина | Direct antonym | Homeland vs foreign land |
| Факел | Огнетушитель | Functional reversal | Fire-bearing torch vs fire-extinguishing device |

**Alternatives still under consideration:** «Зеленобер»,
«Тихоокеаника», «Изумруд», «Низон», «Орендеревня»,
«Гражданские». Naming polish is allowed, but no replacement
is recorded as accepted until owner review.

Do not implement a real-name-to-game-ID relationship in the initial
save schema without explicit versioning, a reviewed rights policy and
separate catalog validation. Avoid source name or external team ID in
the public-facing UI unless there is a clear design reason and a rights
review. Club identities must be independently distinguishable,
including the two «Статика» proposals.

## Rules architecture and no invented shortcuts

- Maintain a **primary-source edition register**: RPL championship
  regulations, RFU disciplinary code, player-status/transfers,
  relevant annexes and IFAB rules; include effective dates, article
  references, source URL, exceptions and test cases.
- Separate `rulesPackId`/`rulesPackVersion` from
  `catalog.packId`/`catalog.packVersion`. The league display title
  `Лига приколов` is a fictional game label, **not** an alias for an
  RFU-issued licensing grant or a sporting document title.
- Do not simplify roster and foreign-player eligibility using passport
  country alone. Avoid inventing substitutions, card suspensions,
  points tie-breakers, administrative forfeits or postponed game rules.
  Unsupported scenarios must be marked unimplemented or rejected by
  the correct validation layer until the source rule is verified.
- Apply the actual RPL season structure, including 16 clubs and
  30 regular-season fixtures per club as verified from the referenced
  source; future promotion/relegation follows genuine relevant RFU/
  First League regulations when those editions are reviewed.
- **M0** records design and source evidence; **M1** implements a
  separate match engine after explicit approval; **M2** adds the
  fictional league/career using an independently validated rules pack.
  The present 16-club generic M0 synthetic dataset remains unchanged
  until the exact fictional names and pack migration/replacement rules
  are approved.

## Acceptance and remaining constraints

**Accepted now:** the league name «Лига приколов», the
real-regulations-only rule-source policy, semantic-reversal approach
to fictional club names, and 2026/27 participants as source inspiration.

**NOT accepted/verified:** the precise sixteen fictional names,
their club designs and city names, rights/trademark clearance, full
article-by-article review of all effective RPL/RFU/IFAB source editions,
modelling and tests of all relevant legal sporting edge cases, staff
qualifications, true-official branding claims, M1 implementation
or finished M0 exit audits.

Legal review matters: inventing a satirical name or using geographic
references does **not** automatically establish freedom to use an
existing logo, distinctive trade dress, another company's database or
registered mark. A public product should have original names,
crests and branding and should not suggest official endorsement.

Relevant design records: [M0 product decisions](../M0_PRODUCT_DECISIONS.md),
[M0 blocker decisions](../M0_BLOCKER_DECISIONS.md),
[RPL article/source register](../M0_RPL_RULES_MATRIX.md),
[data provenance](../DATA_SOURCES.md), [M0 acceptance](../M0_ACCEPTANCE.md).

**M0 exit #2 stays open until remaining source/rule/rights/design and
mandatory two complete repository audits pass. STOP before M1 and
notify the owner; require a separate explicit instruction to begin M1.**
