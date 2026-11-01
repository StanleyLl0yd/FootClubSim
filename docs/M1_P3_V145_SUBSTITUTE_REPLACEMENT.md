# M1 P3 v145 — replacing a previously introduced normal substitute

The original normal-substitution engine already permits a player introduced
from the bench to be replaced later, consuming another of the five normal
changes. The v138 dense UI adapter incorrectly required **all** outgoing
players to have appeared in the pre-match XI. This adapter preflight now
tracks active XI and still-eligible bench after each ordered command.

The 3–5 substitution UI includes previously introduced players as possible
later outgoing players (only where an eligible new reserve remains). New
source-replayed tests cover legal substitute-of-substitute, premature
attempts, removed-player re-entry, real Chrome/Edge IndexedDB source-CAS,
and native reload after the ninth fixture.

This is ordinary 300-second simulated stoppage admission, NOT official
referee confirmation, emergency exception permission, or a clinical record.
Both source v105 engines and M0/v8 persistence/production PRNG are
unchanged. M1/P3/P5 and full exit audit 0/2 remain OPEN, P4 deferred,
M2 forbidden, 2024/25 holdout untouched.
