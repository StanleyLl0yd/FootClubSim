# M1 P4: source-replayed v8 player matchday history

**2026-10-16. Read-only, synthetic, NOT an injury, ban, transfer or
registration eligibility ruling.**

`deriveM1VerifiedV8PlayerMatchHistory(initial, journal, playerId)`
first validates the *entire* independent v8/schema-4 result journal
by replaying all stored match sources. It identifies the given player's
unique registered club in the original synthetic M0 catalog and
returns only that club's **already completed and verified** fixtures,
in real scheduled round order. Unplayed future fixtures do not appear.

Each matchday entry distinguishes:

- `starter`: named in the XI and participated;
- `used-substitute`: named on the bench and subsequently entered play;
- `unused-substitute`: named on the bench but never entered;
- `not-named`: absent from the verified XI and named substitute sheet.

Only a player who actually appeared has a full per-player match dossier
(goals, own goals, xG, penalties, cards, dismissal and synthetic
registered/physical phase seconds). Unused or unnamed players have
`participation: null`, not fabricated zero playing time. Club fixture,
opponent, venue and verified final match score are also included.
Counts for each type of listing are checked against the returned
entries. An unrelated club's result does not create a player entry.

**Boundary:** absence from a matchday list does not itself mean a
player was injured, suspended, sold or formally unavailable; a recent
red card or medical withdrawal does not prove a subsequent eligibility
restriction without a separately confirmed ruling. The projection
does not change the previous v8 season aggregate, generate new match
results, create standings, rewrite stored schemas or begin M2.

Complements M1-P4 #30 and the existing cross-fixture medical/disciplinary
continuity reports. M1 exit #3 remains OPEN.
