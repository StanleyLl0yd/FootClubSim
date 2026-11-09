# ADR-0003: Manager origin, starting competencies and generated biography

**Status.** Product principle accepted on 2026-10-14. The owner approved
the 12 skills, scale and starting distributions on 2026-11-07 for the playable
preview. Future balancing formulas, personal details and milestone acceptance
remain separate design decisions.

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

These three alternatives, the exact starting skill model and the initial
versioned biography generator are **approved and implemented** in the
Playable Preview. Future gameplay effects and deeper personal-history
generation remain separate decisions.

## Manager competencies (distinct from player ratings)

Do **not** conflate footballers' 33 on-pitch skills with the human manager's
abilities. The starting profile uses these stable domain keys.

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

In the first playable profile, the skills describe the manager and inform
the custom biography. **None of the 12 values currently changes a match,
lineup, tactics, training, transfers, scouting, finances, media, or staff
decisions.** A different manager origin never applies a hidden match
bonus or removes player control.

### Implementation/effect boundary (2026-11-09)

| Competencies | Effect today | Potential future responsibility |
| --- | --- | --- |
| `tacticalKnowledge`, `matchPreparation`, `inGameAdaptation` | Stored/displayed; for custom profiles contribute to the fictional biography's analysis/leadership motif | Tactical coaching and preparation may be designed during formal M2 work, **only after** independently agreed, tested, deterministic formulas |
| `trainingMethodology`, `playerDevelopment`, `peopleManagement`, `motivation` | Stored/displayed; contribute to custom biography's development/leadership motif | Training, progression, morale and staff systems in M3+ or a separately approved later slice |
| `talentAssessment`, `scoutingAnalysis` | Stored/displayed; contribute to custom biography's development/analysis motif | Recruitment and scouting systems in M3+ |
| `negotiation`, `clubManagement`, `mediaCommunication` | Stored/displayed; contribute to custom biography's operations motif | Contracts, finance, club administration, and media systems in M3+ |

For former-player and theorist presets, the complete skill vector is fixed
by the selected origin and determines the visible profile; the fictional
biography follows its corresponding origin path. For the custom profile, a
deterministic comparison of four three-skill clusters selects the biography
motif; a tie selects the balanced generalist path. Regeneration changes
only the biography seed and timeline, never the saved skill values.

Future-stage descriptions are **not promises of currently implemented
effects**. M2 and M3+ may refine ownership of individual formulas during
their own acceptance; no preview skill is connected to the v188 match source.
See [#76](https://github.com/StanleyLl0yd/FootClubSim/issues/76) and
[Playable Preview acceptance](../PLAYABLE_PREVIEW_ACCEPTANCE.md).

## Approved starting allocation

All origins share a 1–20 scale, a starting floor of 5, a starting ceiling
of 15 and an exact 120-point total. In the order of the skill table above,
the former player has `10, 9, 13, 8, 10, 14, 14, 12, 7, 7, 8, 8` and
the theorist has `14, 13, 9, 13, 11, 8, 7, 9, 14, 7, 9, 6`.
The custom profile starts at 10 in each skill and permits every integer
allocation satisfying the same bounds and total. It can reproduce either
preset's skill allocation while keeping a custom origin and biography.

The first version collects a display name. Biography events use years
relative to career start and are confirmed before club selection. Future
growth, effects and optional personal details need separate design work.

## Biography synthesis

The first implemented version uses a local, seeded generator with three
canonical timeline events per origin (former player, theorist, or custom),
relative years, version-1 templates and bounded variations. The accepted
events/seed are preserved across reload and complete career export/import.
The following more detailed pipeline remains a **future design direction**,
not a claim that the preview already generates every proposed field.

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

## Implementation stages and remaining gates

- **M0:** completed under ADR-0010; only the original design contract was
  accepted at this stage.
- **Playable Preview:** manager creation, all three origins, approved skill
  budgets, biography preview/regeneration and save/archive persistence
  implemented in [#485](https://github.com/StanleyLl0yd/FootClubSim/pull/485).
  The owner accepted the *preview criteria* on 2026-11-09, but manual product
  acceptance remains OPEN in
  [#488](https://github.com/StanleyLl0yd/FootClubSim/issues/488). This is
  authorized prototype work while formal M1/M2 remain open under ADR-0011.
- **Formal M2:** gameplay effects are **not** implied by the wizard. Any
  future tactical manager effects require a reviewed formula, legal inputs,
  tests and explicit acceptance. M2 sporting/data/rights conditions and its
  own exit audits still apply independently.
- **M3+:** as the training, staff, contracts, recruitment and media systems
  are implemented, wire reviewed manager-skill effects into those systems
  with measurable balancing and transparent deterministic behavior.
  Version later manager growth, reputation and achievements separately.

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

The twelve attributes, 1–20 scale, starting 5–15 range, 120-point budget,
approved presets and version-1 seeded biography are **no longer proposals**.
Still unapproved are starting age controls, manual biography editing, skill
respec/growth, reputation, additional detailed biographical templates, and
all numerical gameplay-effect/balancing formulas. Formal M2 data/rules/rights,
M1 and M2 exit audits, and the separate storage-release gate remain OPEN.

M0 closed under [ADR-0010](0010-m0-final-acceptance.md), M1 was
subsequently authorized, and the playable-first direction was separately
approved under [ADR-0011](0011-playable-first.md).
