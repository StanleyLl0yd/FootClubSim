# M1 P3: substituted injured player may leave without re-entry (v53)

2026-10-22. **Versioned synthetic engine capability, not full IFAB/RPL
or P3 acceptance.** Primary 2026/27 source:
[IFAB off-field treatment and assessment protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/).
The protocol states that substituting an injured player is not delayed by
their ordinary one-minute temporary off-field assessment requirement.

Prior isolated v8 physically blocked any substitution of a player
temporarily absent for treatment, even if their substitution command had
been legally admitted. The v8 public entry point and all existing
journals **retain exactly that legacy behavior**. New
`simulateM1V53MedicalReplacement` intentionally opts into
`simulateM1V53OffFieldSubstitutionSource` while reusing the original
source-checked command eligibility, 11-player roster, referee checkpoint
admission, physical XI and exactly 90 seeded shot draws.

On a valid substitution the off-field patient is permanently removed from
the match and replaced with a named eligible bench player. No artificial
medical re-entry and no fake 60-second eligibility proof are produced.
The new versioned response supplies the exact source-replayed medical
exit and substitution event IDs, match seconds, player and team identities,
and retains the full source match. A later attempted return of the
substituted player fails closed.

The replacement receipt is only emitted when the source event stream
proves that the player was **already medically off the field** when the
substitution was accepted. An ordinary substitution without a prior exit
has a separate typed `NO_OFF_FIELD_REPLACEMENT` response. Tests cover
old-v8 unchanged behavior, both clubs, physically present replacement,
lineup size, invalid entries, a prohibited later return, caller forgery,
malicious getters and deterministic source replay.

**Limitations:** the prototype resolves substitutions at already supported
five-minute checkpoints (including real synthetic half-time) and does not
prove actual live second-resolution timing, official referee authority,
diagnosis, doctor clearance or exceptions for new players injured after
coming off the bench. The remaining five IFAB Law 5 exception paths,
authentic disciplinary sanction lifecycle, full squad eligibility and
medical intermatch recovery are separate open work. A synthetic IFAB
rule-conformant transition is not an authenticated real RPL event.

Existing M0, v8 API and saves are unchanged. P3 #29 and M1 exit #3
remain open; M2 is not authorized.
