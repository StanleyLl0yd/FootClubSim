# M1 P1: durable replay-checked in-match pauses

A compact, untrusted pause draft lives in a separate IndexedDB database.
It contains only the immutable initial fixture identity, journal revision,
selected XI, earlier legal coaching/substitution choices, pause minute,
the canonical pre-match witness, accepted command prefix, and events
occurring strictly before that minute. It contains neither
a future score nor authority to commit a match.

The UI must persist a draft before revealing a new pause. On browser reload,
it first loads the canonical source-verified season and regenerates the
entire match using the exact same source policy; the already-played prefix
must match byte-for-byte, including the earlier admitted tactical and
substitution commands even when their effect on a seeded event was null.
Edited, stale, wrong-career, out-of-order and
oversized drafts are refused. Read/write CAS for confirmed fixtures is
unchanged. Draft writes from an older pause cannot overwrite a later
pause within the same uncommitted match. A successful season commit
invalidates an old draft even if cleanup is interrupted.

This is only P1 recoverable virtual-time match state, not physical
continuous-play clock streaming or source-authoritative external referee
or medical evidence. P1 remains OPEN pending exact-head CI, native
Chrome/Edge/Safari crash/reload checks and final functional acceptance.
Holdout 2024/25 stays SEALED; M2 and release remain blocked.
