# M1 P3 v171 — precommit fictional hold integrity

The v120 CAS store previously applied source replay, **wrote** a proposed
journal, then left v126 fictional hold review to the browser UI. A caller
could construct a fully source-replayable v166 zero-command fixture with a
valid seed but an unauthorized lineup reintroducing a player held by an
earlier fictional dismissal/injury. Source identity alone cannot certify
intermatch eligibility.

The new pure precommit admission composes v120 replay with the full v126
historical-hold audit **before** the native IndexedDB transaction performs
its put. Rejected historical hold bypasses and unverified fictional source
return a dedicated storage error; no revision is written. A fixed-seed test
demonstrates the bypass against the older source-only gate, rejects it
before commit and accepts a legal hold-excluding continuation.

No saved format changes, no external medical or KDK authority and no
automatic season progression. This is P3-1 supporting security work, not
a closed block. P3 0/4, P5 0/5, exit audit #3 0/2. M2 forbidden.

Source-origin admission additionally requires exact known command namespaces and
canonical fixture-derived RNG seeds across the **entire** proposed journal.
Legacy v120 journals retain read-only validation but unverifiable earlier entries
cannot authorize subsequent CAS writes. This does not authenticate external
referee, medical or KDK evidence and does not close P3-1.

The v122 ordinary and v128 fictional-manual modes also require exact
regeneration of the complete source request from their supported preparation
paths; a valid command namespace plus canonical seed cannot authorize a
caller-invented tactical plan or starting XI. This affects only new admission:
legacy replay and saved formats remain unchanged. Other manager substitution
and combined referee modes retain their independent source validators.
