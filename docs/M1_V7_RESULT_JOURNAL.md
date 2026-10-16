# M1 P4: independent v7 match-result journal (schema 3)

**2026-10-16. Partial P4, not a career save or an M1 release.**

`src/core/m1-v7-result-journal.ts` introduces a separate **journal schema 3** and **apply-command schema 3** for v7 `engineVersion: '6'`, `eventSchemaVersion: 7`. Neither existing v5 journal schema 1, v6 journal schema 2, M0 initial-career save nor their readers are migrated or reinterpreted.

## Domain transaction proposal

- Original immutable M0 initial career, pack, career ID and synthetic fixture identity are checked. A result is committed only if `deriveM1VerifiedV7AppearanceReport` independently reproduces **the complete match** from its source seed, policy, exact in-match actions and separately supplied referee adjudications.
- Each result includes the v7 team report, full appearances, chronological typed goal attribution, v6 disciplinary/medical summary, event count and seed/RNG continuation. These are verified before addition.
- Saved journal rows are checked **structurally and across internal totals** on every read. Goal counts reconcile with credited open-play scorers, penalty scorers and own goals attributed to *defending* players. Team shots, penalties, cards, total minutes and xG coverage reconcile with player appearances.
- Goal count is deliberately **not** bounded by `goals <= shotsOnTarget`, because own goals can increase score without a recorded attacking shot. Only genuine open-play plus penalty goals obey that inequality. xG has an explicit `open-play-only` coverage label.
- Duplicate `commandId` and fixture, stale expected revision, mismatched career, changed pack, unsupported schema, impossible player identities and invalid source result return typed errors. The previous value is never mutated; successful applications return revision +1.
- `applyM1V7MatchResultBatch` stages 1..16 commands in memory and returns only a complete final journal. No partial intermediate journal is exposed after a late failure. The caller must write the final state as **one atomic CAS operation**.

## Security and remaining gaps

The v7 module is a **pure, untrusted-memory validator and commit proposal**. It does not authenticate referee decisions or staff authority, does not offer a persistent atomic CAS, and cannot prove that a stored earlier journal row came from a legitimate match simply because its totals are internally consistent. A maliciously modified, self-consistent *entire* career and original source cannot be detected with local schema checks or a plain checksum.

An eventual separately trusted career storage owner must bind `careerId`, trusted pack/rules authority, authenticated decisions and revision, and must perform atomic compare-and-swap of the entire journal with failed-write rollback and concurrency tests. Browser single-player persistence is not automatically equivalent to an externally authenticated authority. **Never pass caller-provided `trustedDecisions` as unquestioned officiating evidence.**

Unimplemented: official Law 14 infringement/retakes, actual referee stoppage control, temporary medical procedures and sanction carryover, interrupted matches and replay protocols, complete player condition progression, calibrated match performance, M2 production storage and full league ranking.

M1-P3 #29, P4 #30, P5 #31 and M1 exit #3 remain open. M2 remains prohibited until owner acceptance.
