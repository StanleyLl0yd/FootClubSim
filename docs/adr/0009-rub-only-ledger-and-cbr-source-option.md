# ADR-0009: RUB-only club ledger, six currency conversion directions, and CBR FX source assessment

- **Decision status:** **ACCEPTED by owner 2026-10-14** for all-RUB internal accounting and 6/6 target-currency rounding directions; **PROPOSED / NOT YET APPROVED** for replacing the previously approved Google Finance quotation source with the Bank of Russia (CBR).
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

## 3. Bank of Russia quotation source: researched recommended alternative, not approved source switch

The owner asked whether **the Bank of Russia's official rates could be used freely**, naming it as a **possible alternative**. That question **is not an explicit instruction to replace the previously approved Google source**; source switch is **PROPOSED** until owner confirms. All other money/bookkeeping rules above **are binding now** regardless of the eventual provider.

### Primary official references reviewed 2026-10-14

- [Bank of Russia's "About the site"](https://www.cbr.ru/about/) says that information/materials may be reproduced in other media/Internet resources, with attribution/link to source. The same page also contains additional provisions concerning commercial uses of its information and specific organized hyperlink use. **Do not assert an unconditional license for every commercial integration** without reviewing those qualifications.
- [Bank of Russia's User Agreement](https://www.cbr.ru/user_agreement/) requires source credit when citing materials, prohibits interference with service and may be amended. It is not a guarantee of a particular uptime/rate-limit/SLA.
- The [official XML developer guide](https://www.cbr.ru/development/sxml/) documents **`https://www.cbr.ru/scripts/XML_daily.asp`** (date parameter `date_req=dd/mm/yyyy`; omission returns latest published rates) and currency identification. The [daily-data SOAP guide](https://www.cbr.ru/development/DWS/) documents alternative methods. These are documented service endpoints, **not an undocumented Google scraper**.
- [Official CBR exchange-rate database](https://www.cbr.ru/currency_base/) states the official USD/RUB and EUR/RUB rates are effective after publication and remain valid until replacement, including on weekends and holidays. These are official **reference** rates, not buy/sell offers or market executable quotes.
- [CBR 2012 clarification](https://www.cbr.ru/currency_base/press/121019_1202524.htm) explicitly recommends using exchange rates from its official website and indicates they need no separate documentary confirmation.

### Source proposal and technical acceptance

If the owner subsequently **authorizes switching to CBR**, use one read of the official daily XML dataset per real calendar login date, selecting `USD` and `EUR`, validating their currency codes, `Nominal` unit fields, `Value`, effective-date attribute, positive bounds and normalized RUB-per-one rates. Derive EUR/USD cross rates mathematically. Cache an **immutable** daily login-date snapshot with source URL, observed effective date, fetched-at timestamp, timezone and digest/integrity metadata; never invent a new publication date on weekends. Show source credit **«Курс Банка России»** with a link to `cbr.ru`. No Google Finance dependency remains if and only if the owner authorizes this replacement.

A browser origin may be prevented from directly requesting the CBR XML feed by **CORS**, hosting restrictions, regional network filtering or provider availability. These have **not yet been independently tested in the target Safari/Chrome/Edge browsers**. If direct CORS access fails, explicitly plan and review a minimal lawful proxy/server-side adapter, or an alternative approved technical mechanism; internet access does not remove browser same-origin restrictions. Do not ship a nonworking direct `fetch` or assert CORS support from a regular server-side request.

**M0 gate:** source feasibility and owner decision must be captured in documentation, but no M3 FX fetch/ledger code is authorized. M3 release must verify applicable reuse terms for the actual use case and any attribution, operational access and CORS reliability. If owner chooses Google despite this option, Google rights concern in ADR-0008/#131 remains fully open.

## 4. Acceptance tests for future M3 implementation

- Six target conversion pairs, exact half-unit ties, positive/negative journal adjustments, source nominal >1, date/timezone boundaries, weekends and holidays, invalid zero/negative/huge rates, overflow, immutable snapshot/replay/import, no edits and only one logical acquisition at first daily login.
- RUB-only cash/accounting budget invariants. Every currency operation produces correct 10,000-RUB book value **from original amount**, independent of target display selection/rounding. Cross conversion remains coherent without intermediate rounding.
- A valid original-currency transaction source sum survives JSON export/import unchanged, while the journal remains denominated only in RUB; changing future rates never changes historic book values.
- Zero-rounding small payment is explicitly handled; no free contracts/transfers, infinite exchange-roundtrip credit, phantom salary liabilities or loss of integrity on missing source/CORS error.
- Current M0 data and saved-career schemas remain unchanged. Completion requires M3 exit testing and its mandatory two repository-wide audits after implementation.
