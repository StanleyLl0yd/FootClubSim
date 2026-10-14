# ADR-0003: Manager origin, starting competencies and generated biography

**Status:** product principle accepted by owner on 2026-10-14. Attribute names,
numerical values, balancing formulas, editable personal details and milestone
acceptance criteria below are **design proposals**, not independently approved
numbers or completed gameplay.

## Context and accepted experience

Creating a career begins with the **human manager's profile**, before choosing
a club. The player has three equally legitimate starting paths:

1. **Former professional footballer (practitioner):** the manager previously
   played professionally and entered coaching/club management from football.
   The profile should emphasize strengths associated with lived match,
   dressing-room and playing experience, alongside possible weaknesses in
   formal analysis, administration or negotiations.
2. **Football theorist / "laptop manager":** the manager did not play
   professionally but has studied football, completed appropriate coaching
   courses and developed through analysis, education and practical work in
   supporting roles. This origin may be stronger in tactics, methodology,
   scouting/data analysis or systematic preparation and weaker in some
   dressing-room/practical areas. It must be a credible, **fully competitive**
   career path, not a joke class or a penalty for not playing.
3. **Custom profile:** the player **manually allocates a fixed pool of starting
   points among manager competencies** rather than choosing an ex-player or
   theorist preset. The application infers a plausible career history from
   the selected strengths and weaknesses. The biography must be internally
   consistent with those allocations.

The application **generates a personal football biography after the profile
is completed**. For the ex-professional, it explains where they played and
what they achieved; for the theorist, where/how they studied, learned and
worked; for the custom profile, it derives a believable history from the
distribution. All text must be reviewable by the user before career creation.

These three alternatives and the relationship between origin, skills and
biography are **approved product requirements**. Actual skill values and
biography content generation mechanisms below are proposed.

## Proposed manager competencies (distinct from player ratings)

Do **not** conflate footballers' 33 on-pitch skills with the human manager's
abilities. Proposed stable domain categories, subject to refinement:

| Key | User-facing concept | Typical impact, once system exists |
| --- | --- | --- |
| `tacticalKnowledge` | Тактическое мышление | Choosing suitable plans and interpreting opponents |
| `matchPreparation` | Подготовка к матчам | Building effective pre-match routines |
| `inGameAdaptation` | Реакция по ходу матча | Recognizing opportunities to adjust a plan |
| `trainingMethodology` | Методика тренировок | Planning training and recovery |
| `playerDevelopment` | Развитие футболистов | Improving individual development decisions |
| `peopleManagement` | Работа с коллективом | Managing relationships and conflict |
| `motivation` | Мотивация | Maintaining squad morale |
| `talentAssessment` | Оценка игроков | Identifying suitability and development potential |
| `scoutingAnalysis` | Анализ и скаутинг | Interpreting scouting evidence |
| `negotiation` | Переговоры | Contract and transfer discussions |
| `clubManagement` | Управление клубом | Long-term operational planning |
| `mediaCommunication` | Работа с прессой | Media interactions and public expectations |

The list is an **initial candidate**, not the final ratings schema or a
promise that all twelve mechanics appear in M2. Some abilities affect M3+
systems (contracts, training, recruiting, media) and should not invent an M1
football match shortcut or rewrite seeded simulation outcomes.

## Proposed balanced starting allocation

- Define one **fixed total starting competency budget** and the same legal
  per-skill floor and ceiling for all origins. An ex-player or theorist is
  a different **distribution** of the same budget, not more free points.
- Practitioner/theorist presets start with distinct, inspectable allocations:
  one may privilege motivation, people skills, player assessment and match
  experience; the other tactical knowledge, methodology, analysis and match
  preparation. Each has concrete strengths and trade-offs. Profiles need
  testing so one is not inherently optimal in every club.
- Custom origin offers a manual allocator with remaining-point counter,
  minimum/maximum values, reset, error messages and preview. Cannot proceed
  with an invalid total or impossible allocation; unspent-point policy must
  be explicit. The player can reproduce any valid preset total through the
  custom allocator.
- **Proposed UX:** preset users can preview the competency sheet before
  confirming and optionally start from its distribution in custom mode.
  Changing to manual allocation changes the **origin** to custom unless
  the design explicitly preserves a separate chosen backstory field.
- A fixed integer scale such as 1..100 would align with player data, but it
  is **not yet approved for manager competencies**. The precise starting
  budget, caps, initial values, growth, difficulty and influence weights need
  explicit balancing/design approval before implementation.
- Biographies should not grant secretly additional gameplay bonuses on top
  of the displayed abilities. If a documented history modifier exists later,
  expose it as part of the same bounded balance and persisted rules version.

## Biography synthesis (proposed deterministic local pipeline)

1. Collect the manager's chosen display name and only the minimal **optional**
   self-description inputs the design ultimately approves (e.g. starting age,
   home region, preferred language/market, fictional-or-real-history policy).
   Never infer the real user's personal identity, nationality or career.
2. Freeze the origin, validated competency vector and a distinct biography
   seed and generator/template version in the manager profile. The generator
   uses a **local seeded algorithm and authored templates**, with no required
   server, API, model provider or network access.
3. Establish a plausible ordered life/career timeline. Account for age and
   years needed for a professional career, coaching courses and jobs; do not
   make someone play for two clubs simultaneously, win contradictory honours
   or obtain credentials before the corresponding education period.
4. **Practitioner:** construct football-playing milestones: believable
   fictional club(s), player position, career span, approximate level,
   appearances/achievements (only if they fit experience and age), transition
   to coaching/management. Professional-playing history is explicitly
   supported for this origin.
5. **Theorist:** construct an education/analysis pathway: learning, coaching
   courses, study projects, youth coaching, assistant analysis or football
   administration. Do not claim a professional playing career. Mention
   licenses/academic qualifications only as **fictional backstory** using
   non-infringing original invented institutions/course details, unless
   a named real credential is actually verified.
6. **Custom:** score relevant clusters and map dominant attributes to
   biographical motifs: tactical analyst, youth-development specialist,
   motivational leader, recruiting/scouting specialist, administrator,
   or a balanced mixed background. Explain strong and weak skills through
   the fictional career arc. **Never automatically invent professional
   football playing history** merely because motivation or player assessment
   is high: offer a choice of grounded background motifs or stay within a
   plausible non-professional path. The exact choice and constraints are
   subject to future UX review.
7. Generate a **structured canonical timeline** first (stable event IDs,
   years, role, fictional entity ID, achievement evidence and template ID),
   then render readable Russian text. This avoids treating opaque generated
   prose as authoritative game state and supports future localization.
8. Show a summary and the competency allocations before confirmation.
   Offer a deterministic **regenerate biography** action that changes only
   the biography seed/history, not the competency pool; preserve a draft until
   the player accepts it. A future manual edit must never silently change
   attributes or gameplay history without validation.
9. Store the accepted biography's versioned structured events and generated
   text (or equivalent stable rendering inputs) **with the career snapshot**.
   A template/code update must not silently rewrite someone's saved
   biography. Export/import reproduces the accepted career history.

### Data integrity and rights

Until real sports data has an independently verified permitted-use basis,
the generated history uses **original fictional clubs, fictional academies,
courses and honours**. The current 16-team fictional M0 pack is not an
assertion about actual historical professional clubs. When a future licensed
real-world database is available, use only compatible rights-cleared
identifiers, seasons and awards. Never fabricate a claim that the *actual*
player is a real-world former professional or holds a real coaching license.

Do not use protected club emblems, player photos or copyrighted football-manager
texts/templates. Make the content visibly a **fictional game backstory**.
Avoid personal data collection, biometric/profile inference or cloud history.

## Separation from responsibilities and staff delegation

Origin affects **the manager's competency starting values and biographical
context**, not the user's authority to manage the club. Regardless of origin,
the manager starts with control of every implemented responsibility and may
delegate individual areas independently under
[ADR-0002](0002-configurable-delegation.md). A theoretically trained manager
can handle the dressing room; an ex-player can negotiate contracts; neither
path locks out any screen or capability. Staff can compensate for weaknesses,
but never silently take authority.

Future effects must be explainable, bounded and deterministic; no secretly
scripted match wins or preferential treatment because of origin.

## Proposed staged delivery

- **M0:** accept the above product requirement, document proposed competency
  contract, biography integrity invariants, UX acceptance tests and
  architectural ownership. No live profile wizard, career schema mutation,
  manager AI or match engine implementation in M0.
- **M1:** no origin feature work. The match engine remains an independent
  seeded calculation under its own reviewed input schema, subject to the
  mandatory M0 exit pause and explicit owner authorization.
- **M2 (first playable browser season):** manager creation flow before club
  selection, three origin choices, default/preset and custom point allocator,
  biography preview/regeneration, durable versioned manager profile and
  offline Russian text, with same-seed replay and cross-browser save tests.
  Connect only mechanics already implemented and whose formulas were
  reviewed; do not claim future abilities already influence gameplay.
- **M3+:** wire training, staff, contracts, recruitment and media competence
  into their respective real systems, with measured balancing and audit
  transparency. Later career development, achievements and changes in
  manager reputation should be versioned and based on actual simulated events.

## Future implementation test cases

1. Each origin generates a valid playable manager and an explicit competency
   sum equal to the same approved total budget.
2. Practitioner and theorist have different, explainable competency
   distributions, with balanced strengths/trade-offs. Neither grants
   unadvertised total points.
3. Manual allocation rejects negative/noninteger/out-of-range values,
   insufficient or excess spending, duplicate fields and invalid IDs.
4. Strong scouting/analysis skills yield a suitable custom biography;
   leadership/development-heavy allocation yields a distinct plausible
   history; balanced allocation produces a meaningful mixed story.
5. Theorist/custom biographies cannot silently acquire a made-up
   professional player history, named real diploma or unsupported honours.
6. Years, ages, jobs, clubs, courses and achievements are chronologically and
   semantically consistent. Zero experience does not produce league titles.
7. Same input, rules/template version and seed produce identical canonical
   events and rendered text; regeneration modifies history only.
8. Editing/previewing a backstory does not change ability points; manually
   assigned abilities do not change from switching UI tabs.
9. Save/export/import/reload preserves origin, competencies, accepted
   biography and generated-seed identity, including across Safari and
   Windows Chrome/Edge.
10. Person-origin and manager competencies never override
    [ADR-0002](0002-configurable-delegation.md) manual/delegated task
    permissions, club budget, competition rules or staff eligibility.
11. Invalid biographical payload/legacy save fails safely or follows an
    explicitly tested migration; no silent fabricated replacement.
12. No cloud call or real-world rights-controlled content is required.

## Open design details

Exact twelve-attribute list, numerical ranges and pool, background-specific
distributions, starting age controls, fictional timeline templates, point
respec rules, UI content lengths, biographical editing policy, future manager
growth/reputation and gameplay influence weights are **proposals awaiting
owner design approval**. The accepted principle does not sign off these
numbers. See implementation tracking issue linked from the project roadmap.

**M0 exit remains OPEN** until all other requirements, rights verification
and two whole-repository review passes are complete. After M0 completion,
report it to the owner and **STOP** before M1 until explicitly authorized.
