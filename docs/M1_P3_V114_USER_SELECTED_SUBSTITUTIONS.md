# M1 P3 v114: manager-selected matchday substitution

Status: **opt-in, synthetic local M1 browser playtest**; partial P3 progress, not final verified referee/medical authority or official career posting.

The v113 browser fixture flow no longer forces a hard-coded outgoing and incoming outfield player when the manager chooses `normal-substitution` or `combined`. UI selects the currently named starting XI and unused matchday bench, excluding goalkeepers for this limited exercise and preventing a combined-case substitution of the independently treated player. The same v8 player-control authority, source replay, foreigner-limit and single-transaction journal CAS are retained; the M0 initial snapshot remains untouched.

A new optional `M1V114SubstitutionSelection` input to `prepareM1V113PlayableMatch` must contain exactly `outPlayerId` and `inPlayerId` as strings. It is rejected unless a substitution scenario was selected, the departing outfield player belongs to the current XI, the replacement is on that same club's named bench and is an eligible outfield player. Incorrect, forged, duplicate or medical-conflicting player selections fail without a preview or commit. The older v113 no-argument scenario keeps its historical default for deterministic compatibility.

Native Chromium/Edge UI smoke plays a first match, reloads M0/M1, selects the different participants in a second match, commits and reads actual IndexedDB v8 source evidence verifying the two chosen player IDs, reloads again and verifies revision 2 while the M0 selected club and revision 0 remain immutable.

**Not yet accepted:** mid-match arbitrary-time commands beyond the virtual checkpoint, medical replacement/long-term recovery authority, generated injury/card event continuation, official point posting, authentic referee signal evidence, complete P3 rules exceptions, real-football statistical P5 acceptance, and the two exit audits. No change to the 2024/25 holdout, M2 or deferred P4.
