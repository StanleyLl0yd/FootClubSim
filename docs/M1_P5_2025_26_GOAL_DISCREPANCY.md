# M1-P5: localized 2025/26 RPL 609-vs-610-goal source discrepancy

**Research observation: 2026-10-17. One discrepancy localized; benchmark NOT approved.**
This is an evidence note for [#31](https://github.com/StanleyLl0yd/FootClubSim/issues/31),
not a new source pack, calibration input, legal conclusion or milestone gate.

## Observed disagreement and primary corroboration

- [Rusfootball's 2025/26 tournament overview](https://www.rusfootball.info/matchcenter/tournaments/rpl/season_2025_2026/)
  reports **240 fixtures / 610 goals**; its
  [Zenit-Akhmat fixture](https://www.rusfootball.info/matchcenter/tournaments/rpl/season_2025_2026/matches/118922)
  is listed as **3:0** for the **26 April 2026, round 27** match.
- [Championat's season overview](https://www.championat.ru/football/_russiapl/tournament/6594/)
  reports **240 fixtures / 609 goals** (348 home, 261 away); its
  [round-27 match list](https://www.championat.com/football/_russiapl/tournament/6594/calendar/)
  lists **Zenit 2:0 Akhmat** on 26 April.
- The [Akhmat club's official match record](https://fc-akhmat.ru/matches/main-team/256337/)
  lists **2:0**, naming the two goals: Sobolev 8', Luis Enrique 11'.
  Crucially, the **RPL's own next-round official pre-match bulletin**,
  [RPL 2025/26 MD28 AKH-PNN, PDF page 3 (zero-indexed page 2)](https://cdn.premierliga.ru/resources/sb_pdf/preview/RPL_2025-2026_MD28_AKH-PNN_PREVIEW.pdf),
  independently records the preceding match as **Zenit 2:0 Akhmat**,
  with the same goal minutes.

The one-goal arithmetic discrepancy is **specifically localized** to
Rusfootball's 3:0 rather than the documented 2:0 score.
Rusfootball's [final standings](https://www.rusfootball.info/matchcenter/tournaments/rpl/season_2025_2026/table)
give Zenit **54 goals for** and Akhmat **40 goals against**,
while [RSSSF's final table](https://www.rsssf.org/tablesr/rus2026.html)
gives Zenit **53 for** and Akhmat **39 against**. These two one-goal
differences are consistent with the identified incorrect match score.

## What is, and is not, established

- **Supported:** the official club match record and an RPL-hosted match
  bulletin corroborate 2:0; Rusfootball's 3:0 appears to be a source
  transcription/aggregation error explaining 610 versus 609.
- **Not independently established:** an exhaustive audit of all 240
  matches, every underlying RPL match protocol, rights to reuse provider
  raw data, source-feed independence, every disciplinary/goal classification,
  shots/xG/injuries, or a licensed immutable full-season benchmark.
- **No promotion to calibration:** the 609-goal summary remains a
  research observation, not a rights-reviewed frozen reference, training
  target, held-out acceptance result or M1 closure evidence.
  The 2024/25 offline candidate workflow, SHA capture and full P5
  acceptance remain separate open tasks.

No third-party raw match archive, logos, source PDF or player datasets are
copied into the repository. The factual score comparison, source links and
limited reasoning are documented only for quality control.
