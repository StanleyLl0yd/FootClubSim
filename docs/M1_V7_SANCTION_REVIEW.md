# M1 P3/P4: confirmed sanctions and completed v7 fixtures

**2026-10-16. Read-only consistency verification. No inferred bans.**

\`reconcileM1V7ConfirmedSanctions\` checks a validated v7 journal against
a separately authenticated **complete** snapshot of already-issued
fixture-specific suspension orders, using the established 2026/27
\`admitM1ConfirmedSuspensions\` pre-match gate. All orders must reference
registered players and real fixture IDs from the immutable synthetic
season. The new review is tied to the original career catalog and journal
revision; it cannot silently substitute a foreign roster or season.

If an order covers an already finalized fixture and the affected player
appears in its verified attribution, return
\`HISTORICAL_PARTICIPATION_CONFLICT\`. If the affected player is absent
from appearances, return \`HISTORICAL_MATCH_SHEET_REQUIRED\` anyway:
the v7 journal does **not** retain complete unused substitute lists.
No retroactive revocation, result rewriting, standings correction or
match forfeiture is automatic. The governing body must resolve any
retroactive case through a distinct documented decision.

If no historical conflict exists, a blocked player currently included
in the XI or bench causes \`CURRENT_LINEUP_BLOCKED\`. A player banned only
for another fixture remains unaffected in this fixture. All results
are read-only, versioned and replayable from caller-supplied source.

**Trust boundary:** empty and nonempty order lists are both unauthenticated
unless an external official-source adapter independently proves their
completeness, freshness and applicability. Nor does the local v7 journal
prove server-authenticated history or authoritative match sheets. Caller
must bind data to a specific career/season and verified regulatory
source before actual use. This is not automatic accumulation of cards,
appeal handling, suspension service across postponed fixtures, an RFU/KDK
adapter or full P3/P4 acceptance.

M1 #29/#30/#31 and exit #3 remain open. M2 is blocked.
