# M0 initial-career storage: exceptional-case acceptance matrix

**Prepared:** 2026-10-14. **Status: TEST PLAN, NOT EXECUTED ACCEPTANCE.** Supports [M0_BROWSER_SMOKE.md](M0_BROWSER_SMOKE.md), [M0 acceptance](M0_ACCEPTANCE.md) and [M0 exit #2](https://github.com/StanleyLl0yd/FootClubSim/issues/2). Neither documentation nor mocked IndexedDB errors constitutes a completed native-browser test.

## Already observed versus missing

| Scenario | Evidence already recorded | Current status |
| --- | --- | --- |
| macOS native Safari normal browsing, initial career save/reload/restore | [PR #38](https://github.com/StanleyLl0yd/FootClubSim/pull/38), automated Safari WebDriver smoke | Verified for M0 revision-0 prototype |
| Windows native Chrome/Edge normal browsing | [PR #67](https://github.com/StanleyLl0yd/FootClubSim/pull/67), independent Windows processes | Verified for M0 revision-0 prototype |
| Windows Chrome Incognito and Edge InPrivate (within one private session) | Windows browser CI private-session branch, save/reload **or explicit denial with JSON export** | Verified within private session; no after-close persistence guarantee |
| IndexedDB absent and simulated QuotaExceededError | Headless domain tests plus actual browsers with an injected rejection object | Error handling verified; **NOT real quota exhaustion** |
| **Safari Private Browsing** | No confirmed native Private Safari execution | **OPEN** |
| **Real browser-enforced storage quota pressure** | No genuine per-origin eviction/quota outcome | **OPEN** |
| **Actual storage eviction** | No observation of automatic browser eviction | **OPEN** |
| **Backup/recovery across complete browser shutdown** | Same-tab reload smoke only | **OPEN** |
| **Windows Chrome/Edge site-data clearing and same-process JSON import** | New CDP fixture under review in browser CI; restores a byte-for-byte stored M0 snapshot and rejects a corrupted backup | **Not equivalent to full shutdown or organic eviction** |
| **Evolving career data and save migrations** | No implemented evolving career schema | M2, not a meaningful M0 functional test |

The CDP harness now contains an additional **isolated disposable Windows browser-profile** recovery scenario that clears real IndexedDB using a browser protocol command and exercises the app's file import with a valid and a tampered snapshot. Its result must be confirmed from the corresponding actual browser CI run before claiming PASS. It does **not** demonstrate that the user clicked Export and downloaded a file, or that browser data is naturally evicted after background storage pressure.

## Native Safari Private Browsing manual protocol

Requires **actual Safari on macOS** with a separate disposable testing profile/session and a local trusted origin (the Vite preview over localhost). Do not use a normal production browser profile containing unrelated personal data.

1. Record macOS/Safari version, automation limitations, test date, exact Git commit and testing origin. Use **File -> New Private Window**; do not treat a WebKit emulator or normal SafariDriver window as a Private window.
2. Load the built M0 shell, choose a synthetic club, create initial career and click Save. The result may be **success confined to this private session** or a clear storage denial. The UI must not discard its active in-memory career in either case.
3. For a successful save, reload **the same private tab** and restore; check club, immutable pack, revision and SHA-256 validation. For a denied save, verify visible error message and export a JSON backup while the career is still in memory.
4. Close all Private windows. Start a **new** Private window and report what storage does, without expecting cross-private-session retention; privacy mode is intentionally ephemeral. Do not assume an absent save is a bug when the browser purges data at closure.
5. If the export has been retained as a file, import into a new instance, check matching career/club, then import deliberately malformed/other-pack JSON and confirm the current memory state remains unchanged. Do not save a copied career over an existing ID.

**Pass** requires explicit observed outcome for each applicable assertion; if the platform denies/blocks private automation, mark **BLOCKED**, give browser version and manual procedure, do not mark PASS.

## Persistent-profile full shutdown/restart and backup recovery

Using an isolated normal Safari or Chrome/Edge profile, export a known-good JSON file from an M0 initial career; save that career in IndexedDB. **Quit the browser application completely**, not just reload a tab, then reopen the same profile and origin. Restore and verify identical club, pack/version, careerId and revision zero. Next, on this **disposable profile only**, clear the test site's storage using the browser's built-in site-data control, then import the previously exported JSON file. Verify integrity and selected club, and check that a corrupted export cannot replace the active in-memory career. Record whether export was actually downloaded, not merely whether the UI displayed an export-success message.

If genuine browser eviction happens during a controlled disposable-profile session, document it separately. **User-triggered site-data clearing is a recoverability exercise, not evidence that organic quota/LRU eviction was observed.**

## Actual quota/eviction requirement and safety

- A mocked `QuotaExceededError` tests exception handling but **cannot** prove OS/browser per-origin quota enforcement, cleanup, automatic eviction or storage survival after browser exit.
- Do not deliberately fill the host's real disk or normal browser profile. Use a disposable VM/browser profile and an explicitly bounded browser quota when supported. Record the exact browser/tool control, applied quota, written data size and actual observed transaction error. An artificial DevTools quota override should be reported as a **browser-enforced test limit**, not as ambient host-disk exhaustion.
- If no real quota is reached, outcome is **NOT TESTED**, not PASS. Do not extrapolate from unit tests, browser simulations or the availability of a configuration setting.
- Active career and existing saved entries must not be silently overwritten or destroyed after failures. Report quota/eviction effects and any inability to recover; never assume IndexedDB persistence is durable enough without a user-controlled JSON backup.

## Evidence form for the eventual acceptance report

Record: `commit`, `OS`, `browser/version`, `normal/private`, `isolatedProfile`, `case`, `storageTechnique`, `precondition`, `observedOutcome`, `PASS/FAIL/BLOCKED/NOT_TESTED`, `screenshots/log reference`, `operator`, `checkedAt`. Missing fields are not inferred. Browser storage limitations can only be accepted as a narrower M0 gate by an **explicit additional owner decision**; [ADR-0006](adr/0006-m0-m2-acceptance-boundary.md) did not approve one.

**Important:** These are initial-career prototype checks; first playable career backups, atomic revisions, migrations and multi-season recovery need separate M2/M4 acceptance even if every M0 case is eventually observed.
