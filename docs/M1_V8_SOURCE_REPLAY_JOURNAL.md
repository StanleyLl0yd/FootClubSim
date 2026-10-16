# M1 P4: isolated v8 source-replay career journal (schema 4)

**2026-10-16. Experimental pure domain transaction, not production career persistence.**

`src/core/m1-v8-result-journal.ts` introduces an **independent
schema-4**, v8-only revisioned journal and apply command. It does not
migrate, upgrade, reinterpret or rewrite M0/v3-v7 saves or previous
journals. The source of truth remains an independently validated M0
career/catalog snapshot; generated fixture IDs must belong to its
double-round-robin calendar and match it field-for-field.

Each accepted fixture item stores a compact **complete replay
provenance claim**: its versioned prematch context, delegated/manager
policy, actual team/disciplinary command source, externally asserted
referee decisions, medical exit/return records, deterministic seed,
RNG continuation, event count and derived **v8 match dossier**. The
immutable catalog is referenced through the career pack rather than
duplicated for each stored result. On every read, the journal
reconstructs the match from the recorded sources, re-derives the
complete v8 physical-XI/bench/scorer/discipline dossier and compares
the entire stored fixture item, rejecting forged score, omitted bench,
changed medical facts, RNG metadata or foreign fixtures.

A pure single-apply and bounded **1..16-item batch** compare expected
journal revisions and block duplicate command IDs, duplicate fixtures,
stale updates, incompatible catalogs, altered match evidence and
interrupted (nonterminal) prefixes. A failing later batch operation
returns an error and **never exposes a partially committed next
journal**; external storage will still need transactional CAS. Inputs
are JSON-copied to avoid aliasing and to reject sparse arrays,
undefined fields, non-finite numbers, cycles and oversized values.
The output contains no points table, financial update, condition
posting, automatic suspension or real match authority.

**Trust boundary:** even completely successful seeded replay proves
only internal consistency against *caller-supplied* sources. It does
not authenticate a referee, medical doctor, club staff authorization
server, competition registration, match abandonment, KDK appeal,
independent license/provenance, or historical journal integrity.
An attacker able to replace both the journal AND the supposedly
trusted career/source claims may construct a self-consistent false
history. This schema-4 journal has **no IndexedDB persistence**,
browser concurrency guarantee, crash atomicity, cryptographic MAC
or remote authenticity channel. Those remain explicit admission
and storage integration gates before production use.

The journal does not introduce legal exhaustion/fatigue modeling
or officially finalized league points. It is **not** a production
career, and M1 #27/#29/#30/#31/#3 remain OPEN. M2 is blocked pending
separate owner acceptance and complete M1 exit verification.
