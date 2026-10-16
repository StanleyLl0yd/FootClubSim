# M1 P4: verified v8 match event timeline

**Experimental, read-only, synthetic source replay. No official match
authentication and no production M2 match screen.**

The isolated `deriveM1VerifiedV8MatchTimeline(initial, journal, fixtureId)`
reads the schema-4 v8 career journal, validates **every** stored result
against its source claims and deterministic RNG, then regenerates the
selected fixture's complete schema-8 event history. It does not read
any asserted user-facing event array or accept provisional checkpoints
as terminal matches. An uncommitted fixture returns `NOT_COMMITTED`.

The response provides the original ordered match events, including
open-play shots (misses/saves/goals), referee-claimed penalties,
own goals, substitutions, cards, medical exits/returns and full-time.
A separate scoring sequence provides event ID, event order, elapsed
seconds, scoring-beneficiary club, involved player's ID, goal type
and the **score immediately after** that goal. For an own goal, the
listed person is the defending player, not the beneficiary club's scorer.

Arithmetic is cross-checked against the fully replayed v8 dossier:
goal attribution IDs/order/people/types must match and the last
running score must exactly equal the stored final score. Journal
contents are never mutated. Reading an older schema, altered source
or score fails closed. The existing stored schema, match engine and
simulated outcomes do not change.

The report's declared status
`SYNTHETIC_V8_REPLAYED_TIMELINE_NO_OFFICIAL_AUTHORITY` matters:
a locally consistent replay is not independent verification of real
referee rulings, medical authorization, competition outcomes or the
honesty of a jointly forged career/source pack. No official standings,
result awards, suspension periods, persistent UI or M2 implementation
are implied. This only advances M1 P4 #30; exit #3 remains open.
