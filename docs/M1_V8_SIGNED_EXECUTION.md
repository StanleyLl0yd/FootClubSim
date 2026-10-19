# M1-P3: verified-source-gated isolated v8 match calculation

**19 October 2026. Research-only signed-source gate, NOT an official
referee/medical authority, legal event adjudication or playable release.**

The older v8 simulator could accept referee and temporary-medical arrays
because they were labelled "trusted", without independent authentication.
[PR #269's detached Ed25519 verifier](M1_V8_SIGNED_AUTHORITY.md)
established a cryptographic source boundary, but it remained separate from
the match simulator. The isolated async
`simulateM1V8WithSignedSource` in
`src/core/m1-v8-signed-execution.ts` links them by **requiring** a
valid source-scoped signature before invoking the same existing
`simulateM1V8MedicalPhases`. There is no second match algorithm.

Admission sequence:

1. Clone strictly plain-JSON prematch, policy, planned commands,
   referee decisions, medical actions, trusted host context and detached
   signed envelope **synchronously before any await**. Reject accessors,
   aliases, cycles, nonfinite values and oversized sources before starting
   cryptographic verification. This prevents time-of-check/time-of-use
   mutation while async WebCrypto is pending.
2. Validate original M1 prematch; match the externally supplied signing
   fixture ID against the actual trusted initial fixture.
3. Verify Ed25519 signature and exact source contents, scoped to the
   authenticated-host-supplied career ID, expected v8 revision and unique
   challenge ID. Fail closed with typed `AUTHORITY_REJECTED` if missing,
   untrusted, forged, stale or changed.
4. Only then run the *unchanged* v8 simulator on the frozen snapshot.
   Invalid source events still return a typed `MATCH_REJECTED`, even
   when signed by a key supplied by the caller.

A successful result is explicitly labelled
`SIGNED_SOURCE_CHECKED_NOT_OFFICIAL_AUTHORITY`. It means only that the
**provided** Ed25519 public key verified the exact frozen source content.
It must never be advertised as an IFAB/RFU/RPL referee's ruling or medically
valid event. The host must additionally authenticate key issuer and
role, bind the career/revision to real verified storage, prevent replay of
challenge IDs, and handle key revocation/rotation. A browser-generated key
or stable string does not establish these proofs. The signed entrypoint is
not wired into the production app, CAS journal, or automatic match engine.

Tests exercise a valid signed-but-research-only match, changed career,
fixture/revision/challenge, wrong key, edited score, signed illegal penalty,
malformed source, getter attack and mutation during the asynchronous
signature check.

The M0 fixtures, base catalog, v3-v8 journal formats and prior
`simulateM1V8MedicalPhases` behavior remain unchanged. Nothing is
automatically persisted, retried, authenticated as official or awarded
in standings. [M1-P3 #29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
[P4 #30](https://github.com/StanleyLl0yd/FootClubSim/issues/30) and
[M1 exit #3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
remain OPEN; M2 prohibited.
