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
history. A separate, experimental v8 IndexedDB revision-CAS prototype
now exists (see [M1_V8_INDEXEDDB_CAS.md](M1_V8_INDEXEDDB_CAS.md));
native Chromium/Safari/Windows tests cover specific navigation and concurrent
writer cases only. Genuine quota/eviction, OS-crash durability, authenticated
sources, cryptographic MAC and production backup recovery remain unverified.

The journal does not introduce legal exhaustion/fatigue modeling
or officially finalized league points. It is **not** a production
career, and M1 #27/#29/#30/#31/#3 remain OPEN. M2 is blocked pending
separate owner acceptance and complete M1 exit verification.

## Bounded source-replay batch efficiency (2026-10-16)

The pure schema-4 batch API validates and source-replays the *untrusted prior
journal once* before running its 1..16 new commands synchronously against the
internal JSON-copied result. Every appended fixture still undergoes its own
strict source, actual deterministic match and dossier verification. Public
single-apply and persisted IndexedDB commits continue to source-replay their
untrusted stored journal on entry. A failed middle command returns no partly
committed next journal; the caller's original record is unchanged. Tests
compare a four-fixture batch with sequential validated commits and reject a
forged third result. This is a bounded complexity optimization, NOT permission
to trust new browser data or skip external CAS/fixture-source verification.

Initial 8-fixture **single-apply** Linux CI diagnostic from PR #215
([workflow](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38901794763/job/116975573222))
measured 7.12 seconds cumulatively in domain apply and 1.52 seconds for
final replay validation. These are machine-specific observations; the full
240-game lifetime, browser latency, real quota and approved performance budget
remain unverified.

## Full-season workload probe and replay cost (2026-10-16)

The dedicated path-scoped `M1 v8 season workload` CI workflow uses
the existing bounded CLI with `--fixture-count=240 --batch-size=16`,
seed 1 and the original synthetic 16-club calendar. It is limited to
20 minutes on a pinned Node 24 / Ubuntu runner, and logs bounded
16-fixture progress to stderr plus full final replay, season-statistics
verification, journal size, memory and time measurements. The optional
CLI `--progress` flag never changes the final JSON stdout report. A completed run establishes only those measurements on
that runner; timeout, quota-like journal-size rejection or other
failure must be reported rather than silently omitted. No measured
result or production latency threshold is presumed here.

Within each public v8 journal admission, the generated approved
fixture lookup is now shared across the old-history replay and every
new batch entry instead of regenerated for each fixture. The initial
bounded strict JSON round trip also makes a second deep JSON round
trip for each prior fixture unnecessary; its individual 160,000-character
limit remains enforced. Every old fixture is still independently
source-replayed and reconciled with the complete derived dossier,
and every new fixture is still individually simulated, asserted and
size-limited. Verified 16-entry batches, poisoned prior records and
late forged results have explicit regression tests.

The cost of replaying the full untrusted prior journal remains
proportional to its length on every separate CAS transaction.
Thus 240 one-by-one applications can cost much more than 15 batches
of 16; neither application style may skip source verification.
The workflow is **not** a measured cross-browser responsiveness,
IndexedDB quota/eviction, fatigue/condition, authenticated-ruling,
calibration or release-acceptance gate. M1 P3/P4/P5 and exit remain open.
