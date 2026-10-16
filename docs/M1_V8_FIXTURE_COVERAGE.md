# M1 P4: source-replayed v8 fixture-coverage review

**2026-10-16. Synthetic diagnostics, not an officially playable season.**

`deriveM1VerifiedV8FixtureCoverage(initial, journal)` strictly validates
and source-replays the entire isolated v8/schema-4 journal BEFORE counting
any completed fixture. The accepted M0 synthetic calendar is reconstructed
from the immutable club-ID order; both its rounds and the source-verified
fixtures remain the only schedule reference.

The returned read-only report includes:

- 30 synthetic rounds, each with deterministic expected, completed and
  pending fixture IDs and a completion flag;
- global accepted/pending fixture counts and first incomplete round;
- for each synthetic club, completed and pending home/away match counts;
- full-season completion only if all 240 unique generated fixtures have
  source-replayed terminal match records.

The report does **not** calculate league points, rankings, relegation,
awarded/forfeited matches, injuries, condition or squad eligibility.
An incomplete round does not block another round from being recorded.
Chronology is based on generated round/fixture order, not on when a result
was appended; no game record is rewritten or automatically generated.

Every stored result still depends on caller-supplied source claims that are
not externally authenticated. The report does not certify official
RPL 2026/27 fixtures or data rights, real-world match results, career
persistence, quota/eviction or sporting regulation compliance.

The new code is a standalone, additive M1 projection. It changes no M0
catalog, save, versioned event, v3-v8 journal format, match engine or
persistent IndexedDB store. P4 #30, statistical P5 #31, M1 exit #3 and
the owner authorization gate for M2 remain OPEN.
