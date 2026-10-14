# ADR-0008: Online browser operation, once-daily FX snapshots and coarse conversion rounding

- **Status:** ACCEPTED BY OWNER, 2026-10-14 (later refinement of D07 and browser availability policy).
- **Supersedes:** the **mandatory offline-capable/offline-first gameplay** requirement in the earlier *proposed* [ADR-0001](0001-web-offline-first.md), and the automatic refresh/offline-stale/cent-rounded **currency conversion policy** of [ADR-0007](0007-match-tactics-multicurrency.md). It does not repeal the other approved match, staffing or career decisions.
- **Scope:** requirements and future adapter interface, **not an M0 exchange-rate implementation**.
- **Subsequent owner source decision:** [ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md) **replaces Google Finance with the Bank of Russia** as the approved primary exchange-rate source. Every Google-specific provision below is historical, **superseded** by the ADR-0009 CBR XML contract. The once-per-day immutable snapshot and directional rounding constraints remain binding.
- **Later owner refinement:** [ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md) **overrides** the multi-currency ledger interpretation and completes EUR/USD target rounding: all financial postings are in RUB to 10,000 ₽, while all foreign target displays round to 1,000 $/€. It also researches a **CBR source option (not yet accepted instead of Google)**.

## Owner decision

FootClubSim is a **browser game that may require internet connectivity**. There is no mandatory promise to launch or play a full career offline. Computing matches and verifying saves still happen deterministically in pure, client-local code where designed; loss of connection must not corrupt saved careers or rewrite prior financial history.

On the **first entry to the game for each real-world calendar day**, the future M3 currency adapter obtains **one immutable RUB/USD/EUR quotation snapshot from the official Bank of Russia XML feed**, subject to verified access and use terms per [ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md). Subsequent entries and conversions on the **same** calendar date reuse that snapshot without another automatic request. The snapshot is immutable once captured and cannot be edited by a player or retrospectively replaced. On a new calendar day, append a *new* independently identified snapshot; never mutate or recalculate previous snapshots or already committed transactions.

Only **two independent base quotes** (USD/RUB and EUR/RUB) are necessary for a coherent three-currency snapshot; USD/EUR and reverse directions can be mathematically derived from those same quotations. If an approved provider interface returns all three pairs in one batch, it must still validate coherence and retain one logical, immutable dated snapshot. The requirement is **one daily logical acquisition attempt**, not necessarily one HTTP request if the lawful interface mandates a batch or several network requests. No mid-session fetching merely because a different player selects a conversion. No automatic refresh every screen, fixture or transaction.

The date is the **local calendar date of game entry**, with the chosen timezone recorded in the snapshot. A quote can have an earlier publication date (weekends, holidays, service delay); its **actual quotation time/date** is recorded and shown rather than fabricated as fresh market activity. The logical snapshot for an entry date stays fixed for that date even when a delayed quote arrives. If the daily acquisition fails, clearly mark the date's rate unavailable; do not quietly present a previous-day quote as today's. Source permissions and supported service behavior remain a hard integration gate, not waived by online-only product design.

## Conversion and rounding rules

| Conversion direction | Result currency | Round the final converted result to |
| --- | --- | --- |
| USD -> RUB, EUR -> RUB | RUB | Nearest **10,000 ₽** |
| RUB -> USD | USD | Nearest **1,000 $** |
| RUB -> EUR | EUR | Nearest **1,000 €** |
| EUR <-> USD | USD or EUR | **Approved later by ADR-0009:** nearest **1,000 $ or €** in the target currency |

Examples for illustration only, **not real quotes**: a calculated ₽1,234,567 conversion from dollars or euros is displayed/booked at the approved conversion resolution as ₽1,230,000; a calculated $12,600 conversion from rubles becomes $13,000. Use deterministic **nearest-unit rounding, exact half up / half away from zero**. Do **not** round the Google market quote itself to an invented rate; apply coarse rounding only **once to the final target-currency amount**, after exact decimal/rational rate multiplication.

**Accounting safety:** Keep the source amount with its original currency and precise integer kopeks/cents, record the unrounded mathematical target equivalent, the displayed/committed target rounded result, rounding quantum, frozen FX snapshot ID and rounding delta in the audit trail. Switching UI display currency is not itself a payment. A real exchange/payment must balance by explicitly recording the effect of this coarse rounding; it must not create untracked money or silently alter native contractual wages/budgets. For low positive conversions that would round to **zero**, do not silently execute a zero-value payment or erase a balance; surface the limitation and require a separately designed policy before enabling such a transaction. These edge cases need tests and potentially later owner decisions.

**Immutability:** Store original source quote/date/time, logical date, source attribution and rates in an append-only record (or cryptographically/integrity protected immutable career snapshot where applicable). Once a game transaction uses a snapshot, that transaction must permanently reference its exact quote; a subsequent day's quote changes only future conversions. Players cannot edit rates; import validation must reject attempts to rewrite a committed snapshot.

**Ledger precedence:** The owner subsequently clarified that **all posted financial entries are RUB-only**, rounded to nearest **10,000 ₽**, irrespective of currency of a contract/deal. USD/EUR remain source transaction and display currency attributes, not cash/budget subledgers. See [ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md). The EUR/USD display quantum is now **1,000** target units; neither EUR/USD conversion nor a display switch changes RUB postings or past transactions.

## Approved provider: Bank of Russia

The owner **explicitly replaced Google Finance with the Bank of Russia** in [ADR-0009](0009-rub-only-ledger-and-cbr-source-option.md). The required once-per-day, uneditable quotation snapshot is supplied by the [official XML daily rates interface](https://www.cbr.ru/development/sxml/). Parse `USD`, `EUR`, `Nominal`, `Value` and the **actual CBR effective date**. Cross-calculate EUR/USD from the same two RUB quotations. Display `Курс Банка России` with source attribution. **Do not call, scrape or fall back to Google.**

CBR's [reuse notice](https://www.cbr.ru/about/) describes source-attributed reproduction, but final commercial use conditions and actual cross-origin access from Safari/Chrome/Edge remain unverified and are **M3 release/adapter gates** [#131](https://github.com/StanleyLl0yd/FootClubSim/issues/131). No M3 finance code, quotation data or external fetch is permitted during M0.

## Tests and milestone gates

- The entry-date gate must be testable with an injected clock and source adapter; verify first entry, same-day re-entry, other-timezone boundary, next day, market-closed days, provider error and inability to mutate snapshots.
- Verify all RUB/USD/EUR supported routes, two base quotations and coherent cross rates, exact rounding (including ties and negative adjustment entries), unchanged historical conversions across next-day updates, overflow, very small amounts and import/export integrity.
- Connectivity may be required for game startup and exchange updates; when unavailable, give an actionable error and protect existing local data. Do not represent unavailable daily CBR rates as retrieved.
- **M0:** accept and document this amended owner decision; no finance code, CBR integration, rates or modification to the original synthetic M0 catalog/saves.
- **M1/M2:** engine and playable game features remain under their own approvals. Browser connectivity policy is updated for future acceptance, but existing M0 saved-career recovery tests remain valid and mandatory M0 storage exceptions are not automatically waived.
- **M3:** implement with [#131](https://github.com/StanleyLl0yd/FootClubSim/issues/131) **only once authorized** and lawful access resolved; actual exchange transaction rounding and fixed daily quotes must be reproducible, traceable and safe.
