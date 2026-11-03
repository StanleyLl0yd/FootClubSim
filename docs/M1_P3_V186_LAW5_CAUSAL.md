# M1 P3-2: source-bound 2026/27 Law 5 physical-foul exception

This is **partial integrated playable-engine evidence**, not medical
diagnosis, external referee authority, clinical clearance or full P3-2
acceptance. The existing v184 match source is unchanged in its persisted
request/result schema, RNG, generated actions and v120 journal format.

2026/27 [IFAB Law 5](https://www.theifab.com/laws/latest/the-referee/)
and [off-field protocol](https://www.theifab.com/laws/latest/off-field-treatment-and-assessment-protocol/)
allow a player injured by a **physical offence for which the opponent is
cautioned or sent off** to remain on the pitch after assessment, without
requiring it to be completed quickly. The same protocol says ordinary
off-field returns must await one **running-clock** minute after a real
restart, with referee permission; touchline entry during play.

The v186 projection is **called by the actual v184 generator before it
produces a source claim admitted to v120/v171**. It binds each modelled
medical patient to the same sanctioned opponent, whistle, restart,
v105 persisted availability action and current physical XI. For the
synthetic on-field exception it requires no medical departure or return.
For the modelled off-field choice it requires a source exit/return after
300 running seconds, a synthetic referee signal and touchline entry,
and rejects participation while absent. Source and persisted replay
are checked together; fabricated patients, clearances and mismatch
fail closed before journal write.

The 300-second model is **coarse and uncalibrated**, not a certified
second-resolution match clock. The referee signal is internal fiction,
not a signature. Other legal exceptions (injured keeper, keeper/outfield
and teammate collisions, head/severe injury, injured penalty taker),
bleeding clearance and competition-dependent concussion replacements
remain explicitly UNSUPPORTED, not silently admitted.

Neither historical v182 nor v184 persisted actions are rewritten. M1
OPEN; P3 0/4, P5 0/5, exit #3 0/2; 2024/25 holdout SEALED and M2
prohibited. Do not promote a gate from this subset alone.
