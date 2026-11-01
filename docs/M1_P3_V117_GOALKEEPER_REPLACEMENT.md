# M1 P3 v117 — legal goalkeeper substitutions

This opt-in M1 playtest exposes an existing **already engine-validated**
capability: replacement of the starting goalkeeper with a registered,
available named **reserve goalkeeper**. The same v8 core replay and normal
substitution admission gate enforces exactly one goalkeeper in the XI,
starter/bench membership, current foreign-player cap, timing and authority.
Goalkeepers are no longer excluded categorically from the manager's outgoing
selection. The incoming picker filters to the matching goalkeeper/outfield
class to prevent accidental illegal commands.

The default for existing automated callers remains an outfield-to-outfield
substitution at 300 seconds. Combined temporary-treatment scenarios still
exclude their temporarily treated outfield patient as the outgoing player;
all other historical source objects and M0 snapshots remain unchanged.
M1 result CAS, replay and existing saved source schemas are unchanged.

Unit regression checks cover legal keeper-for-keeper half-time changes,
forged keeper/outfield cross-role commands, physical XI, source replay and
M0 immutability. Native Chromium and Windows browser smoke follows a real
fourth controlled-club fixture, chooses a keeper, records the half-time
replacement to IndexedDB and restores after browser restart.

This is a fictional test interface, not an authenticated referee signal,
complete injury/discipline recovery, full interactive live game, P3 closure,
P5 calibration acceptance, a release sign-off or M2 authorization. Holdout
2024/25 is not used; P4 remains deferred; exit #3 requires two full passes.
