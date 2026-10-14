# ADR-0007: Approved match interaction, tactical control and three-currency finance

- **Status:** ACCEPTED BY OWNER, 2026-10-14 (M0 product interface decisions D03-D05 and D07-D11).
- **Scope:** Architectural/gameplay **contracts**, not an implementation or claim that a match engine, conversion feed or finance ledger already exists.
- **Preserves:** [ADR-0002](0002-configurable-delegation.md) responsibility delegation, [ADR-0004](0004-liga-prikolov-rpl-rules.md) genuine applicable sporting rules, [ADR-0006](0006-m0-m2-acceptance-boundary.md) M0/M2 separation, all 16 approved club labels/badges, 46 approved «Надир» identities, and the immutable synthetic M0 save/catalog.

## Decisions accepted

| Decision | Binding approved principle | Initial implementation stage |
| --- | --- | --- |
| **D03** | **One deterministic, event-driven, headless football simulator** for both user and AI fixtures. Support **interactive in-match decisions** as well as fully automated/fast-forward match calculations; 2D/3D animation is optional, not required. Both paths must produce valid event-ledger-derived reports using the same rules. | M1 engine/event and command boundary; M2 season and match UI |
| **D04** | Preserve **33 original footballer attributes** (28 outfield and 5 goalkeeper) on integer 1..100 scales. Ratings are independently authored. Potential, fitness, condition and form are distinct evolving state rather than silently rewritten base ratings. | M1 modeling; M3 development |
| **D05** | Pre-match AND **during-match** formation, team mentality, pressure, defensive compactness/line, passing risk, tempo, substitutions and **individual player instructions**. Choices probabilistically affect play, not predetermined victories, and can be delegated separately where an eligible employee exists. | M1 versioned inputs/event model; M2 working UI |
| **D07** | Club finance supports **RUB, USD and EUR**, selectable display currency, **automatic conversion using a **single immutable Google-referenced quote snapshot captured at first game entry per real calendar day, subject to lawful source access**, with nearest 10,000 RUB / nearest 1,000 USD/EUR directional rounding**, and independently auditable multi-currency money balances, budgets, wages and transfer entries. No binary-float money arithmetic. | M3 finance and approved FX integration |
| **D08** | Contract proposal, negotiation, signature, medical/registration and match eligibility are separate transactions. Authorization and genuinely applicable eligibility/budget rules remain binding after staff delegation. | M3 with M2 eligibility contract |
| **D09** | Career save pins every source catalog/rules/engine/PRNG/schema and manager version; imported or upgraded packs must not silently rewrite old careers. Future transactional revisions and migration/backup are integrity checked and atomic. | M2+ |
| **D10** | First playable M2 includes one coherent **16-club, 30-round, 240-match** season; multi-season aging/youth/regens/promotion and relegation extend in M4. | M2/M4 |
| **D11** | Russian-first browser UI with network access assumed when needed, dense accessible tables and keyboard/mouse controls, recoverable errors; target real macOS Safari and Windows Chrome/Edge first. | M2/M5 |

**D13 detailed manager skill names/point budgets/biography UX, optional city presentation, legally verified 2026/27 official eligibility rules and remaining M0 browser/rights/audit gates were not included in this sign-off.**

**Superseding owner finance detail (2026-10-14):** [ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md) overrides this ADR's former **multi-currency ledger** terminology: canonical internal accounts use **RUB alone**, posted to nearest **10,000 ₽**, while USD/EUR are permitted for contract quotations and display. EUR ↔ USD now rounds to nearest **1,000** target units. The CBR is a researched *option*, **not** yet authorized in place of Google.

## D03/D05: in-match tactical commands and deterministic replays

A manager may open an interactive match, inspect current match state and **pause**, resume, change replay speed/fast-forward, request substitutions, alter team shape and parameters, or issue available **individual instructions**. A fully automated match remains a first-class equivalent mode, not a different simplified match generator. No real-time pitch rendering is mandatory; event timeline and accessible match statistics are sufficient initially.

- Treat each accepted user or delegated-staff decision as an authorized, versioned **command with virtual match timestamp, sequence, actor, prior game revision and selected tactic/roster delta**. Apply it once at the next legally permitted boundary, e.g. stoppage for substitutions; preserve the explicit command acceptance/rejection reason and the exact execution time.
- Validate remaining replacements, bench legality, active-lineup counts, player availability, IFAB/RPL substitution windows, red cards, injuries and tactical bounds from the **fully verified competition-specific versioned rules pack**. No universal invented "five substitutions" shortcut in a synthetic M0 validator. Individual instructions must not sneak in an unapproved gameplay engine in M0.
- If match processing is fast-forwarded, input commands must be associated with defined virtual-time checkpoints, **not** nondeterministic wall-clock races. The seed/PRNG continuation, commands, order and emitted events all persist so **identical inputs reproduce identical results**. In-match intervention necessarily changes the subsequent simulation trajectory, not previously committed events.
- The AI manager uses the same command validity, authority and event pipeline as the human manager. Pre-match and in-match responsibility delegation are independently controllable: a named authorized member of staff may perform match changes only for specifically delegated duties, and the player can reclaim control at permitted boundaries.
- A M1 engine may supply pause/checkpoint/command capability as a **contract**, but there is **no authorization to implement M1 before M0 exit and later explicit owner approval**. The current `MATCH_LEDGER_VERSION=1` is report-only for shots/full-time and must **not** be retrofitted with unversioned substitution commands; future in-match schema changes explicitly increment protocol versions.

## D07: currency, exchange-rate and accounting invariants

### Three user-visible currencies

- **RUB** (₽), **USD** ($) and **EUR** (€) are the only approved initial currencies. The player may switch the global display currency without changing the native currency of contractual sums, held cash or historical ledger transactions.
- Base reporting currency for the Russian club league is **RUB** by default. A wage or transfer denominated in EUR/USD retains its **native original currency and amount**. Show the chosen display-currency equivalent automatically with the **rate as-of date, quotation time and source**. Changing the display setting never performs a transfer or revalues historical booked results.
- **Historical rule, superseded by ADR-0009:** amounts may retain original RUB/USD/EUR currency tags in documents, but the canonical posted club ledger is **RUB only**, at the nearest 10,000 ₽. Exchange quotes are fixed-precision positive decimal/rational values and never converted using binary floating-point. **The later [ADR-0008](0008-online-daily-fx-rounding.md) governs the conversion output:** when converting USD/EUR to RUB, round the final result to **10,000 ₽**; RUB to USD/EUR to **1,000** target-currency units. Do not round an intermediate exchange rate; preserve the original exact amount, displayed/accounted result and auditable rounding difference. EUR/USD direct rounding is not yet specified.
- Maintain separate operating cash, committed expenditures, wage ceiling and transfer budget, all as **RUB-denominated accounts in a single club ledger**, with transaction native-currency metadata. A budget display revaluation is **not** a real currency exchange. A true conversion/payment requires an authorized transaction recording input currency+amount, output currency+amount, the **frozen FX snapshot**, simulated/real date as applicable, fee (if any), accounting delta and committed career revision. All entries must balance under the chosen accounting policy.

### Updated online-game FX schedule and source constraints

**Amended by owner on 2026-10-14 in [ADR-0008](0008-online-daily-fx-rounding.md):**

- This browser game **may require internet connectivity**; mandatory offline play and stale-quote fallback are **not** approved product requirements. Protect saved careers from connectivity errors; never fabricate a quote on failure.
- At the **first entry to the game for each real calendar day**, if access is lawful, obtain **one immutable daily Google quotation snapshot for RUB/USD/EUR**. Re-entering on the same calendar date or making further conversions reuses that saved snapshot **without re-querying Google**. On the next date append another snapshot, leaving previous quotations and transactions untouched.
- Converting from **USD/EUR to RUB** rounds the final target amount to the nearest **10,000 RUB**; from **RUB to USD/EUR** to the nearest **1,000 USD/EUR**. EUR/USD cross conversions use coherent base quotes; **[ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md) now approves nearest 1,000 units of the USD/EUR target currency**. Use deterministic exact arithmetic; never silently erase a small positive payment by rounding it to zero.
- Google Finance's [published disclaimer](https://www.google.com/intl/en/googlefinance/disclaimer/) restricts copying/downloading/storing/redistribution or commercial reuse without prior written permission. The owner has chosen Google's displayed quotations as the desired source, **not** granted permission for an undocumented API, scraping or caching. Finding an authorized supported automated interface remains an **M3 implementation blocker** [#131](https://github.com/StanleyLl0yd/FootClubSim/issues/131).
- No exchange-rate data is imported into the **M0 synthetic catalog** and no finance integration is implemented during M0.

## Explicit milestone gates

**M0:** record this owner sign-off in the product checklist, specifications and issue #2, confirm required input/ledger versioning design and leave actual code, licensed FX ingestion and future-rules execution untouched. M0 continues to require source-licensing assessment, actual applicable browser acceptance, final full two-pass repository audit and CI.

**M1:** implement only when separately authorized: deterministic football event generation and a versioned match/checkpoint/command contract allowing future pauses and in-match modifications. Mathematical calibration and source-rights gates remain separate.

**M2:** playable season and match-management UI, conditional on genuine RPL/RFU/IFAB rules, original 16-club personnel data rights and exact M2 sign-off. Full ongoing finance/FX mechanics do **not** become obligatory in M2 just because D07 is now approved for M3.

**M3:** [issue #131](https://github.com/StanleyLl0yd/FootClubSim/issues/131) tracks actual transaction ledger, three-currency cash/contracts, Google-source lawful FX integration, one daily entry-time immutable quotes/replay and coarse target-currency rounding and the corresponding tests. **Do not claim M3 finance is complete without a lawful Google integration or an explicit owner-approved revised source strategy.**
