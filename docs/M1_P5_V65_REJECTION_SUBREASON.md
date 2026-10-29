# M1 P5 v65: typed subreasons inside referee UNSUPPORTED_COMMAND

In PR #345, 17/17 source rejection cases in a 256-run bounded sample
were identified only as REFEREE:UNSUPPORTED_COMMAND. v65 splits this
umbrella into stage-specific **research-only** reasons without changing
the normal simulated match response or accepted source engine state.

Categories are: too many foul windows (>18), invalid/duplicate foul
windows, invalid referee action time, unsupported substitution rules,
unknown action kind, referee/substitution ordering ambiguity, generated
foul mismatch and same-second goal restart with foul.

The diagnostic modifies an optional trace object passed only by the
explicit diagnosis entry point; normal M1 v23/v29/v31 simulation and
career journals retain their old response contracts, no new storage.
The defensive 18-foul-window limit is NOT changed in this PR, and
same-second goal/foul ambiguity is deliberately not guessed away.

The ephemeral hosted v64 research job replays 256 fixed-seed cases
under the new branch, checks conservation and publishes both the
umbrella categories and typed subreason counts. A subsequent targeted
repair requires a confirmed distribution, rules reasoning, negative
tests and replay differential evidence before any change to match
calculation. Neither CI green nor finite synthetic samples establish
statistical calibration, medical authority or real RPL referee behavior.

P3 #29, P5 #31 and M1 exit #3 remain open; M2 prohibited.