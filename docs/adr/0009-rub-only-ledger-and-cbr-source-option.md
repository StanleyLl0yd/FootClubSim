# ADR-0009: RUB-only club ledger, six currency directions and approved Bank of Russia FX source

- **Decision status:** **ACCEPTED by owner 2026-10-14**, including a **later explicit owner decision to replace Google Finance with the Bank of Russia as the sole primary FX source**. Prior RUB-only accounting and 6/6 target-currency rounding directions remain accepted.
- **Supersedes:** the "multi-currency accounting ledger / original-currency balances" interpretation in [ADR-0007](0007-match-tactics-multicurrency.md) and [ADR-0008](0008-online-daily-fx-rounding.md), plus ADR-0008's *unspecified* direct EUR/USD rounding. Retains their one immutable logical source-quotation snapshot on first login each real calendar day, source attribution and legal-use controls.
- **Stage:** M0 is documentation only. Implement financial conversion and book entries at M3 under [#131](https://github.com/StanleyLl0yd/FootClubSim/issues/131). Do not alter original synthetic packs, current saves, identities, match rules or authorized M1 timing.

## 1. Single RUB accounting currency (owner-approved)

Every club financial operation is **recognized and posted in Russian rubles only**. The canonical club general ledger, cash, committed funds, operating/transfer budgets, wages and transaction balances are **RUB, rounded to nearest 10,000 RUB for each posted amount**. There are **no separate USD or EUR balance sheets or club cash journals**.

Player/staff contracts, proposals and incoming/outgoing deal paperwork **may be denominated and displayed in RUB, USD or EUR**. Preserve the **unrounded amount and original currency** as source-document/transaction attributes for audit and deterministic replay, but convert the accounting entry using the frozen quotation snapshot for the transaction date; post **the RUB-rounded value** in the single RUB ledger. A different display currency is a read-only view and does not change posted ruble balances. Existing immutable journal entries must not be recalculated after a daily rate changes.

To prevent silently creating/deleting cash by coarse rounding, each posted entry must carry: source currency and native quoted amount, exact intermediate RUB value, final RUB amount rounded to the nearest 10,000, signed rounding delta, frozen FX snapshot ID, logical transaction date, origin/actor and career revision. Net posted changes are journal-balanced in RUB; do not perform a second conversion/rounding to reconcile. If an amount would round to zero or if aggregated small payments could make a material difference, **block or explicitly surface the condition until a separate minimal-amount policy is approved**. This choice represents a **game accounting rule**, not legal/regulatory rules for real-world Russian bookkeeping. Avoid labeling game figures as tax/statutory accounting records.

## 2. Target rounding in all six ordered currency pairs (owner-approved)

| Conversion direction | Target rounding quantum | Canonical accounting entry |
| --- | ---: | --- |
| USD -> RUB | Nearest **10,000 ₽** | Final RUB result, to 10,000 ₽ |
| EUR -> RUB | Nearest **10,000 ₽** | Final RUB result, to 10,000 ₽ |
| RUB -> USD | Nearest **1,000 $** | Underlying source RUB amount, posted to nearest 10,000 ₽ |
| RUB -> EUR | Nearest **1,000 €** | Underlying source RUB amount, posted to nearest 10,000 ₽ |
| EUR -> USD | Nearest **1,000 $** | Exact **EUR -> RUB valuation** posted separately in RUB to nearest 10,000 ₽ |
| USD -> EUR | Nearest **1,000 €** | Exact **USD -> RUB valuation** posted separately in RUB to nearest 10,000 ₽ |

All conversions use **exact positive decimal/rational rates** (including the currency nominal/par unit), not floating-point cent arithmetic. The **unrounded** cross rate EUR/USD is computed by dividing the two source RUB rates from the same daily snapshot; round **only once to the target currency quantum**. Do **not** round a virtual intermediate ruble conversion to 10,000 before calculating the USD/EUR display result. Separately, the book value of the operation is derived from the **original source sum** and rounded once to 10,000 RUB. Identity currency views preserve their native amounts unless independently defined formatting applies. Use deterministic nearest-multiple rounding; exact half-ties go **away from zero**. Store original numeric input, snapshot, book-value rounding and target display rounding as distinct values.

**Worked illustration, not actual CBR rates:** EUR 100,000 with a hypothetical 95 RUB/EUR and 80 RUB/USD implies exact book value 9,500,000 RUB, posted at 9,500,000 RUB; target USD 118,750 before rounding and **119,000 USD displayed**. This does not create a USD ledger or 119,000 dollars of additional club cash.

**Boundary safeguards:** small positive payments that quantize to zero, rounding-induced budget overspend, exploitative conversion roundtrips and two-way currency inconsistencies must have deliberate, tested errors/policies in M3. Model incoming and outgoing RUB journal sides atomically. Do not silently mutate original contract nominal amounts by target-display rounding.

## 3. Bank of Russia quotation source: APPROVED

**The owner has explicitly approved replacing Google Finance with the Bank of Russia.** The official Bank of Russia daily foreign-exchange quotation feed is now the **only primary FX source specified for FootClubSim**. Google Finance is **not** a fallback, secondary feed, scraping target or hidden dependency. Source selection is closed; implementation, legally applicable reuse obligations and browser transport feasibility still require verification at M3.

### Primary official references reviewed 2026-10-14

- [Bank of Russia's "About the site"](https://www.cbr.ru/about/) says that information/materials may be reproduced in other media/Internet resources, with attribution/link to source. The same page also contains additional provisions concerning commercial uses of its information and specific organized hyperlink use. **Do not assert an unconditional license for every commercial integration** without reviewing those qualifications.
- [Bank of Russia's User Agreement](https://www.cbr.ru/user_agreement/) requires source credit when citing materials, prohibits interference with service and may be amended. It is not a guarantee of a particular uptime/rate-limit/SLA.
- The [official XML developer guide](https://www.cbr.ru/development/sxml/) documents **`https://www.cbr.ru/scripts/XML_daily.asp`** (date parameter `date_req=dd/mm/yyyy`; omission returns latest published rates) and currency identification. The [daily-data SOAP guide](https://www.cbr.ru/development/DWS/) documents alternative methods. These are documented service endpoints, **not an undocumented Google scraper**.
- [Official CBR exchange-rate database](https://www.cbr.ru/currency_base/) states the official USD/RUB and EUR/RUB rates are effective after publication and remain valid until replacement, including on weekends and holidays. These are official **reference** rates, not buy/sell offers or market executable quotes.
- [CBR 2012 clarification](https://www.cbr.ru/currency_base/press/121019_1202524.htm) explicitly recommends using exchange rates from its official website and indicates they need no separate documentary confirmation.

### Binding technical integration contract (future M3)

Use **one logical daily acquisition** from the Bank of Russia's documented official XML dataset (`https://www.cbr.ru/scripts/XML_daily.asp`) on the **first game entry of each real-world calendar day**, selecting `USD` and `EUR` by verified currency code. Request the **latest effective rates** by default (the API documents this behavior without `date_req`) and parse the returned `Date` attribute, `CharCode`, `Nominal` and `Value` correctly, including comma decimal separators and the effective rate *per one unit* (`Value / Nominal`). Never infer that every calendar day has a newly published exchange rate. Derive EUR/USD and USD/EUR from the same coherent RUB base quotes. Do not round rates before deriving cross quotes.

Persist a **single immutable logical snapshot** for the player's calendar entry date, with its zone, provider=`bank-of-russia`, canonical URL, actual CBR effective-date and source values, positive normalized rates, fetch timestamp and integrity metadata. Reuse the same snapshot across later logins and conversion requests *that date*, regardless of changes on the external page. The **next entry date** creates a new snapshot. No player editing or retroactive replacement is allowed. Cite the source visibly as **«Курс Банка России»** with an appropriate link to `https://www.cbr.ru/`. A failed request must report a failure without fabricating a successful update or mutating an earlier snapshot.

**Browser connectivity remains an open technical gate:** cross-origin browser access can fail because of **CORS**, rate limits, regional filtering or service outages. These have **not** yet been independently demonstrated on actual Safari/Chrome/Edge clients. If direct browser access is not possible, M3 must design and review a **minimal CBR-only fetch adapter** using an explicitly approved server/proxy/relay (no Google fallback), appropriate security and source-attribution controls, without adding a mandatory third-party account. A normal server-side fetch **does not** prove browser CORS compatibility.

**Use-rights gate remains open:** the official [reuse/attribution notice](https://www.cbr.ru/about/) allows reproduction of site information with source attribution while also containing conditions that require review for the actual commercial deployment. Neither an officially documented API nor the owner's source selection guarantees free commercial redistribution, an SLA or unlimited calls. Verify precise terms, notice wording, caching/usage restrictions and user-visible attribution before M3 release.

**M0 gate:** owner source approval and the source contract are documented; no M3 network code, live quote data or finance ledger is introduced. M3 #131 still owns legal, network, parser, date, replay and reconciliation tests. Google is **excluded** as a provider, so its restrictions are no longer the project's intended integration blocker.

## 4. Acceptance tests for future M3 implementation

- Six target conversion pairs, exact half-unit ties, positive/negative journal adjustments, CBR source nominal >1, XML comma decimal separator, missing/duplicate USD or EUR codes, effective `Date`, first daily login and same-day reuse, zone boundaries, weekends/holidays, provider errors and cross-origin CORS or approved proxy routing, overflow, immutable snapshot/replay/import and non-editable rates.
- RUB-only cash/accounting budget invariants. Every currency operation produces correct 10,000-RUB book value **from original amount**, independent of target display selection/rounding. Cross conversion remains coherent without intermediate rounding.
- A valid original-currency transaction source sum survives JSON export/import unchanged, while the journal remains denominated only in RUB; changing future rates never changes historic book values.
- Zero-rounding small payment is explicitly handled; no free contracts/transfers, infinite exchange-roundtrip credit, phantom salary liabilities or loss of integrity on missing source/CORS error.
- Current M0 data and saved-career schemas remain unchanged. Completion requires M3 exit testing and its mandatory two repository-wide audits after implementation.
