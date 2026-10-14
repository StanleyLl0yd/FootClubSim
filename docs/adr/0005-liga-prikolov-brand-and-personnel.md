# ADR-0005: Approved club names, circular badges and roster prototype direction

**Status:** product/visual decisions approved 2026-10-14. **Roster factual and rights verification: OPEN.**

## League naming and identities

The owner approved all 16 fictional club names in the order encoded in `src/branding/identities.ts`. The names are public display strings and each fictional club has its own independent stable `lp-*` ID. In particular, the two clubs are named **Статика М1** and **Статика М2** (not merely Статика, and not locality labels). This supersedes the earlier five-name status and the earlier no-suffix decision in ADR-0004.

## Badge style, approved

All badges use original, three-zone concentric circles: **inner disk**, **middle ring** and **outer ring**. The letter is the first Cyrillic character of the fictional club name; colors evoke the source clubs without copying crests, shapes, fonts, team marks or artwork. Colors and ring order are product design choices, not assertions about official Pantone brand standards.

- **Надир:** inside blue `#1253A5`, middle white `#FFFFFF`, outside sky blue `#77C7F4`; large **Н**.
- **Статика М1:** sky-blue outside, blue middle, white inside; large **С**, small **М1** beneath.
- **Статика М2:** blue outside, white middle, sky-blue inside; large **С**, small **М2** beneath.
- The other 13 badges each have three colors, with no subtitle. Their exact preview palettes are in the versioned identity catalog. These can be adjusted after small-size contrast reviews without altering stable club IDs.

SVGs are drawn at runtime from project-authored geometric primitives rather than distributing third-party crest files. The preview is **not** a league rule/data pack and does not modify synthetic M0 careers.

## Rosters and staff

The owner approved **real 2026/27 club/player/staff prototypes** for the initial fictional-world snapshot: nationality, birth year/age, positions and relative ability are to be grounded in verified season-specific sources, while visible names are original, moderate parodies. This supersedes the earlier *fully unrelated synthetic people* direction **for the future gameplay pack**, but does not automatically grant third-party distribution/publicity/database rights.

Each fictional person must have a stable non-name ID, original display name, independently reviewed factual-data provenance, as-of date, role(s), uncertainty markers and later simulation-only mutable career state. Coach qualifications, foreigner status and contract registration require separate rule verification; attributes are original gameplay estimates, not copied from third-party games. Local regeneration for future fictional players uses country-aware dictionaries, deterministic RNG and no external LLM/network. After career creation, snapshot person names and attributes; later pack updates do not retroactively edit saved characters.

The names of the 46 proposed **Надир** characters approved by the owner are staged in `data/drafts/nadir-personnel-v0.json`, **not yet verified as accurate football registrations on 2026-10-14**. Remaining 15 clubs have an explicit `data/drafts/liga-roster-worklist.json` acquisition/review queue, not invented rosters. No photorealistic portraits or copied logos are authorized.

## Gates and implementation boundaries

- Maintain `data/packs/m0-synthetic-manifest.json` and its schema unchanged: 16 synthetic teams, 368 test players, revision-0 saves remain compatible.
- Use a **new** vetted, dated and versioned game catalog in M2, independent from RPL rules-pack versions. Do not silently extend current M0 synthetic importer with real-person records.
- Verify season snapshot, source terms, rights, minors, duplicate identities, ages, affiliations and roster eligibility before importing each club. Avoid bulk scraping restricted databases.
- Perform an original crest/name/trademark/publicity review before any external release. Satirical name transformation and abstract colors do not by themselves prove clearance.
- The pending M0 milestone audit and explicit stop before M1 under `AGENTS.md` remain in force. This is M0 foundation/preview work only.
