# M1 P3-2: opt-in source-driven goalkeeper assessment in playable v188

## Functional boundary

The **existing** `prepareM1V188LeagueMatch` and
`applyM1V188LeagueMatch` replay pipeline now supports an opt-in
`medicalPolicyVersion: 2` for a narrowly modelled exception: a
**seed-selected goalkeeper injured in a physical offence for which the
opponent is cautioned/sent off** may undergo an immediate *on-field*
assessment and remain in the physical XI. The patient must be the
actual goalkeeper on the original seeded whistle and restart; the
carded opponent and the physical transition in the persisted v105
chronology are independently checked. Later shots still require one
physically present opposing goalkeeper.

Pass `2` as the fifth argument to `prepareM1V188LeagueMatch` to
opt into this **fictional** medical source. Returned
`sourceLaw5Evidence` identifies the actual incident, referee whistle,
restart, player and absence/presence disposition. The proposal reports
`externalMedicalAuthorityAuthenticated:false`. That field is
**transient**; callers cannot append their own medical authority or
medical evidence to the persisted request.

## Primary rulebook and trial boundary

This narrow on-field exception follows [IFAB 2026/27 Law 5](https://www.theifab.com/laws/latest/the-referee/)
and the [off-field medical protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/).
The separate [goalkeeper injury protocol](https://www.theifab.com/trials/goalkeeper-injury/)
remains an IFAB **trial**; its compulsory temporary outfielder
withdrawal is **not** automatically applied to the fictional league
without evidence of competition adoption.

## Versioning and replay

- The journal root stays `schemaVersion:188`. The opt-in request
  records `medicalPolicyVersion:2`; successful apply records it on
  the matching source entry. The new tag is accepted only together
  with the existing `disciplinePolicyVersion:2` dense replay source.
- Entries without this medical version retain the exact previous
  deterministic player-selection and treatment source. Existing
  unversioned/v2 careers remain readable and writable.
- Once a v2 medical source is present, future proposals automatically
  continue that policy and a later downgraded entry fails journal
  verification. Invalid or future version values are rejected.
- An exact source replay validates the saved physical events, player
  and referee chronology; the policy tag is **not cryptographic proof**
  of the original historical generator when bytes happen to coincide.
- This mode is opt-in, not silently enabled for every existing career.

## Not supported

This narrow fictional goalkeeper case overlaps the already modelled
*opponent carded physical offence* exception. It **does not** implement
an independent goalkeeper injury, same-whistle multiple patients, a
keeper/outfielder collision, same-team collision, concussion/severe
clinical clearance, injured penalty taker, source-awarded penalty,
60-running-second precision returns, or authentic external referee /
clinical authority. It must **not** be counted as P3-2 acceptance.
P3-3/P3-4/P5 and both repository-wide exit audits also remain OPEN.

The test `P3-2: v188 opt-in keeper assessment is replay-bound and save
compatible` runs on the selected playable journal and checks a
seeded positive witness, physical goalkeeper presence, historical
compatibility, two-fixture CAS, unsupported authority forgery,
version downgrades and saved-source mutation. CI outcome must be
verified on the exact HEAD before this feature is merged.

The existing `examples/m1-v188-cas-smoke.html` now exercises the same
opt-in v2 through actual IndexedDB in native Chromium, Windows Chrome/Edge
and macOS Safari, including page reload, a blocked downgrade, duplicate
CAS writers and preservation of the immutable initial career. The full
240-fixture Chromium observation intentionally continues exercising the
legacy default; its passing result is not substituted for this v2 smoke.
