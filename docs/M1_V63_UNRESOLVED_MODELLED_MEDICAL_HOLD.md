# M1 P3 v63: unresolved modelled injury-withdrawal medical hold

This is an **opt-in synthetic career precaution**, not a real-world
medical diagnosis, physiological recovery model or authenticated
physician's clearance.

The v29 referee/medical source can permanently withdraw a player due
to a **modelled** injury-like incident. Earlier v58 verified both
clubs' disciplinary suspensions but did not constrain their team sheets
against these source-replayed permanent medical withdrawals on prior
fixtures.

The new v63 gated fixture interface first validates the original M0
catalog plus the entire untrusted schema-6 journal by full source
replay. It sorts historical fixtures by synthetic round (NOT journal
insertion order), tracks each player's latest unresolved modelled
permanent withdrawal, and checks both clubs' previous and current
named team sheets, including the **bench**. The first later appearance
in a previously committed match fails
\`HISTORICAL_UNRESOLVED_MEDICAL_CONFLICT\`; a current named
player fails \`CURRENT_MODELLED_MEDICAL_HOLD\` before simulating
any goal or match event.

A current XI excluding all pending held players proceeds to existing
v58 two-club source-replayed disciplinary checking and v29/v31 game
simulation. The result includes the exact source fixture for each
unresolved hold. No career data or browser persistence is changed.

Because there is **no authenticated or even narrow modelled clinical
recovery decision**, the hold does NOT expire automatically after N
rounds. Simply omitting the player from an intervening match never
clears the hold. This is deliberately conservative until recovery
authority and explicit versioned clearance evidence exist. It is
not an assertion that a withdrawn real-life RPL player is injured
or disqualified.

This increment cannot address live concussion/severe injury Law 5
exceptions, certified medical fitness, real RFU/KDK cases, other
special goals or P5 statistical calibration. M1 P3 #29 remains
OPEN, M2 prohibited.
