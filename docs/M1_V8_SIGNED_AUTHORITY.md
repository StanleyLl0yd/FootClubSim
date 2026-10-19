# M1-P3: externally pinned, cryptographically signed referee/medical claims

**19 October 2026 - research-only authority transport; no official issuer
certified, no signed production decisions, M1 remains OPEN.**

## Problem and scope

The current v7/v8 `trustedDecisions` and `medicalActions` contracts validate
structure, event chronology, eligibility and deterministic source replay.
They **do not authenticate** the browser-generated referee/medical assertions.
A stable `decisionId`, `trusted-referee` string or `refereeSignalId` is
not a cryptographic signature. No autonomous football simulator can declare
that an unsourced event was personally approved by an RFU/IFAB referee, doctor
or competition disciplinary committee.

The isolated, async verifier
`src/core/m1-v8-authority-attestation.ts` checks a **detached Ed25519**
signature on a versioned and byte-bounded JSON payload including the **entire**
list of referee decisions and temporary-medical actions plus:

- exact `careerId` and `fixtureId`;
- the expected atomic v8 journal revision;
- an externally issued, one-time `challengeId`;
- the domain-separated `footclubsim-m1-v8-referee-medical-source` purpose.

It compares the complete signed sources with the caller's intended commands
and rejects changed goals, medical times, extra fields, aliases, noncanonical
JSON, signatures from a different key, wrong match, stale revision or reused
challenge context. The key must be supplied independently by a **trusted
host**, never copied from the signed envelope or editable browser save.
The signed message is exactly UTF-8 of `JSON.stringify(payload)`; signature
is unpadded canonical base64url. No private key or trust anchor was created
or distributed as production configuration. Unit tests generate temporary
Ed25519 keypairs for proof of verification only.

**A successful cryptographic check means only** that the source was signed by
the holder of the private key corresponding to the provided public key.
It does NOT establish that the signer is a real referee, physician or
competent disciplinary authority. Issuer onboarding, key rotation/revocation,
authorization policy, independently trusted clock/challenge registry, and
per-fixture unique issuance must be performed outside browser-local JSON.
An offline/local browser cannot mark its own generated key trusted.

The normal v8 domain simulation and read-only source replay are still
mandatory. These signatures cannot override invalid player eligibility,
restarts, goals, injuries, law exceptions or CAS conflicts. No signing is
performed in the game; no network connection or server was introduced.

## Remaining P3 acceptance

The project still lacks authentic real-world RFU/RPL/IFAB appointment and
match-decision distribution, physical legal stoppage/entry enforcement,
concussion/medical exceptions, disciplinary KDK authority, appeals and
comprehensive referee match progression. This module does not hook a signer
into the production headless engine or change accepted M0/v3-v8 persistence.
P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
P4 [#30](https://github.com/StanleyLl0yd/FootClubSim/issues/30) and
M1 exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
remain OPEN. M2 is not authorized.
