# ADR-0004: Liga Prikolov with genuine RPL sporting regulations and fictional reverse-name clubs

**Status: All 16 exact fictional names APPROVED 2026-10-14.** The two Dynamo-inspired clubs are officially **Статика М1** and **Статика М2**. Original three-ring badge designs and roster-prototype direction are approved in [ADR-0005](0005-liga-prikolov-brand-and-personnel.md). Rights, actual season-roster verification, and sporting-rule completeness remain OPEN. No playable real-prototype pack is released.

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
4. Use **real 2026/27 season personnel as verified factual prototypes** for the future fictional starting squads, while displaying independently authored parodic names, generated gameplay ratings and original geometric badges. Do not copy protected crest assets, photos or proprietary datasets. A season-specific, rights-reviewed source and release gate is required before bundling factual rosters.
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

## 2026/27 source-team mapping: 16 approved fictional aliases

All entries were approved by the owner on 2026-10-14. The real club names below are documentary design references, **not** a licensed football database or game affiliation. The stable fictional IDs, colors and badges are in `src/branding/identities.ts` and [ADR-0005](0005-liga-prikolov-brand-and-personnel.md). The existing revision-0 M0 test catalog is unchanged.

| Real prototype (design reference) | Approved fictional name |
| --- | --- |
| Зенит | **Надир** |
| Краснодар | **Зеленобер** |
| Локомотив | **Вагон** |
| Спартак (Москва) | **Патриций** |
| ЦСКА | **ОГКМ** |
| Балтика | **Пацифика** |
| Динамо (Москва) | **Статика М1** |
| Рубин | **Изумруд** |
| Ахмат | **Упрёк** |
| Ростов | **Спадов** |
| Крылья Советов | **Корни Запретов** |
| Оренбург | **Орендорф** |
| Акрон | **Низон** |
| Динамо (Махачкала) | **Статика М2** |
| Родина | **Чужбина** |
| Факел | **Огнетушитель** |

**Статика М1** (Москва prototype) and **Статика М2** (Махачкала prototype) each have a unique club ID, distinct public name and own abstract badge; the second line inside each badge is exactly «М1» or «М2». No fictional city renaming is approved or required to distinguish them. The earlier same-name/no-suffix proposal is superseded by the owner's explicit decision.

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

**Approved:** all 16 exact names, two independently named «Статика» teams, original concentric circular badges with «М1»/«М2», recognizable but original parody person names, real roster prototypes as a future product direction, and authentic source-verified sporting rules.

**Still OPEN:** factual roster/source verification, permissions for distributing substantial third-party records in this public proprietary repository, rights/publicity and original-name/trademark review, official effective rule edition completeness, frozen versioned playable data pack, migrations. The two whole-repository M0 exit passes and M0 acceptance subsequently completed under [ADR-0010](0010-m0-final-acceptance.md).

The 46 «Надир» parody names are approved but are not certification that all referenced real people were registered with «Зенит» on 2026-10-14. Fifteen more squads remain to be researched; no generated placeholder can be reported as a verified real-world roster. Current M0 remains a synthetic test pack.

**Do not start M1 without explicit separate owner instruction after M0 gate.**
