# M1 P3 v113: browser fixture → verified match → journal CAS

Status: **isolated synthetic browser playtest, not P3 acceptance or official career posting**.

## User path

1. Select a fictional club and create a normal M0 initial career.
2. Save the M0 career to browser IndexedDB (add-only, no overwrite). Imported
   M0 data must be identical to its locally persisted initial snapshot.
3. In the separate M1 section, start or resume the source-replayed v8 journal.
4. Preview the next unplayed fixture for the controlled club, choosing an
   ordinary game, temporary medical departure/return, a normal substitution,
   or both. These are **synthetic virtual game scenarios**; no official
   medical/referee authorization is claimed.
5. Inspect the result and explicitly confirm it. The browser commits exactly
   one complete source-backed result using the existing v8 readwrite CAS.
   A stale revision, corrupt journal or an invalid match is rejected atomically;
   after a failed commit the app reloads the durable source before proceeding.
6. Resume later from the same browser via M0 restore then M1 resume. The M0
   add-only initial save and its SHA-256 envelope are not changed.

The result displays score, shots/on-target, event counts and last recorded
fixture. Fixtures for the controlled club progress chronologically. Seeds
are deterministic per fixture and initial source state, not historical RPL
results. Replays remain independently checked by the existing v8 journal
admission contract.

## Explicit safety and feature limits

- Uses the existing **v8 engine**, not the new v103/v105 100-second research
  chronology. The latter does not yet support career CAS or trusted authority.
- Uses source-validated synthetic team lineups with the registered-player and
  foreigner-cap gate. It does not grant medical recovery or ignore a historic
  dismissal/withdrawal: a prior unresolved dismissal or permanent injury in
  an involved club **blocks the next playtest** until the P3 authority flow
  exists. It does not attempt to reconstruct KDK/doctor rulings from guesses.
- Does not award official league points, authenticate real referee signals,
  verify physical substitution wall-clock evidence, propagate long-term medical
  prognosis, or complete season-wide standings. This is a **controlled-club
  preview history**, not a published multiplayer league simulation.
- A single match outcome is not expected to match real history. P5 acceptance
  concerns independently measured statistical tendencies, distribution and
  randomness with declared tolerance and taxonomy; the 2024/25 holdout stays
  untouched.
- The M0 schema and storage database, production RNG and original archived
  match journals are not rewritten. M2 is forbidden; P4 is deferred.
- Initial implementation performs expensive synchronous journal validation;
  large-season UI responsiveness, cross-browser native user flow, authorized
  referee/medical events and full career progression remain required before
  #29 and #31 can be closed.

## Acceptance evidence to collect

- Exact-head TypeScript/format/unit tests and Chromium/Safari/Windows smoke.
- Real user-driven browser check: M0 save → initialize M1 → scenario preview →
  commit → hard reload → M0 restore → M1 resume, with a concurrent-tab stale
  revision rejection and no M0 mutation.
- A separate full P3 integration increment for authoritative in-match
  substitutions, generated referee injuries/cards, medical recovery and
  discipline continuity. No broad M1 exit claims from this slice alone.
