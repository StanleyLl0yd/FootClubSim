# M1 P3 v96 - foreigner-cap-safe deterministic lineup proposals

The previous source-verified v82 (medical) and v84 (automatic ban)
lineup proposals selected the **first ten registered outfield
players** without searching domestic reserves when the registered
candidate exceeded the M0 competition maximum of seven foreigners
on the pitch. `validateLineup` correctly rejected this candidate,
but a legal alternative XI could already exist among the exact same
source-registered players. This is a false declaration of
`INSUFFICIENT_ELIGIBLE_REGISTERED_PLAYERS` or
`NOT_ENOUGH_REGISTERED_PLAYERS`.

v96 extracts one shared, read-only
`selectM1V96EligibleRegisteredLineup` for both v82 and v84.
Every exclusion is supplied by the pre-existing fully source-replayed
medical/automatic discipline gate. Candidates come only from the
original registered player list, never from an unsigned transfer
or caller-suggested extra club. The selector:

- Examines each eligible registered goalkeeper in registration order.
- Starts with the earliest ten eligible outfield players.
- If the XI exceeds the foreigner cap, deterministically replaces
  the latest foreign outfield starters with later eligible domestic
  reserves until legal. If this is impossible, it examines the next
  goalkeeper. It never manufactures domestic status.
- Rebuilds the bench from all remaining source-registered eligible
  players, up to the already approved M0 bench limit.
- Runs the original `validateLineup` to enforce GK/foreigner/
  registered/duplicate/starter/bench constraints.
- Returns `null` if no eligible legal XI exists.

Both v82's source-replayed injury holds and v84's source-replayed
v56 automatic one-match bans remain excluded; v84 independently
revalidates both clubs. v76's complete source-based medical and
discipline admission plus native IndexedDB CAS remains mandatory
before any persistence. An accepted proposal is **not** clinical
clearance, referee/KDK authority or a new event source.

New tests cover unchanged default teams, 8 first-choice foreigners
with eligible domestic reserves, a foreign starting goalkeeper
with only a domestic reserve goalkeeper legal, source-replayed
empty-history first-round v82 + v84 integration, medical-style
exclusion input, and the genuinely impossible all-foreign
outfield case. All tests are deterministic and do not alter
M0 games, RNG, schemas or deferred P4 batch APIs.

This is stacked on v95 PR #374 (full registered reserve recovery);
retarget to exact main and rerun all required CI after #374 merges.
P3 #29, P5 #31 and exit audit #3 remain OPEN.
M1 OPEN, M2 prohibited.
