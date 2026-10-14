# M0 browser smoke check (manual)

This standalone QA page is deliberately **not** the planned React/Vite product UI. It exercises the existing headless domain modules and the preliminary IndexedDB initial-career store in a real browser without introducing new dependencies, a hosted backend or real sports data.

## Start locally

From a clean checkout of FootClubSim, with Node.js 24, npm and Python 3 available:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build:core
python3 -m http.server 8000
```

Open `http://localhost:8000/examples/m0-browser-smoke.html`.

Running from `file://` can fail because of browser ES module origin restrictions. Localhost is a secure context for Web Crypto. The generated `dist/` directory is build output, not a committed asset.

## Acceptance exercises

1. Confirm the page reports 16 synthetic clubs, 368 players, 30 rounds and 240 fixtures, with a successful calendar integrity check.
2. Select another fictional club, create an initial career and verify the selected club, schema version and revision 0 are shown.
3. Export the JSON file; import the same file. The career ID and selected club should survive unchanged.
4. Modify the inner payload string of the downloaded JSON without recomputing the checksum, then import. It must be rejected with `INTEGRITY_ERROR` rather than replacing the current displayed career.
5. Import malformed JSON and an unsupported schema; verify a readable rejection and no loss of the current displayed career. Also import a valid export from a different synthetic seed: the standalone diagnostics page must reject the incompatible pack while keeping the active career.
6. With an initial career created, click **Сохранить в IndexedDB** and confirm success. Repeating the action with the same career ID must return `DUPLICATE` and keep the existing stored value.
7. Reload the page: in-memory state disappears. Click **Восстановить тестовую карьеру**, then verify the original club and ID are restored from IndexedDB.
8. In private browsing or with storage blocked, confirm that storage errors are surfaced without replacing the active in-memory career. Do not interpret this as a successful persistence test without recording real-browser observations.

Record browser brand, exact version, operating system, each observed result and any console errors. Target macOS Safari and Windows Chrome/Edge individually. No real-browser acceptance can be claimed from Node CI or a WebKit substitute.

## Existing automated browser evidence

- [PR #38](https://github.com/StanleyLl0yd/FootClubSim/pull/38): actual Safari on GitHub macOS 15 verified UI rendering, creating an initial career, IndexedDB save, reload and recovery.
- [PR #39](https://github.com/StanleyLl0yd/FootClubSim/pull/39): actual Windows Microsoft Edge verified the same initial-career flow and duplicate-save rejection.
- [PR #67](https://github.com/StanleyLl0yd/FootClubSim/pull/67): Windows 2025 CI separately launches **Google Chrome** and Microsoft Edge (same CDP smoke) and verifies initial-career save, duplicate rejection, reload, restore and unavailable IndexedDB, alongside actual macOS Safari and Linux Chromium ([four-browser CI run](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38473107523)).
- [PR #40](https://github.com/StanleyLl0yd/FootClubSim/pull/40): Safari and Edge verified a simulated unavailable IndexedDB API does not erase the active in-memory career.
- Windows Chrome (`--incognito`) and Edge (`--inprivate`) now have **dedicated native-process private-session smoke paths** in the same workflow. In each, storage must either succeed for this session with same-tab reload/restore or fail explicitly while preserving in-memory state and allowing JSON export. These checks do **not** prove browser-data survival after private-window closure, and they do not exercise macOS Safari Private Browsing.
- [PR #35](https://github.com/StanleyLl0yd/FootClubSim/pull/35): Linux Chromium renders the production-built React shell. This check alone does not exercise persistence.

These automated cases are for the production React shell, not a claim that each manual exercise on this standalone diagnostics page has been performed. Browser versions and any remaining untested scenarios must be recorded explicitly before release.

The native Windows Chrome/Edge CDP harness additionally contains a disposable-profile **explicit IndexedDB-clear and JSON-import recovery check**: after the ordinary save/restore flow it reads the known M0 snapshot as a test fixture, clears the origin's IndexedDB via the browser protocol, verifies `NOT_FOUND`, imports the saved file, rejects its intentionally corrupted variant and saves the recovered career. That clearing exercise alone is **not** confirmation of automatic eviction, downloaded-file UX, real quota exhaustion or full browser-process restart *by itself*; the distinct Windows export and restart tests are recorded below.

The native Windows Chrome/Edge smoke now additionally **exits and restarts the complete browser process** using the same isolated test profile, then asserts that the recorded M0 career restores from IndexedDB. [PR #127](https://github.com/StanleyLl0yd/FootClubSim/pull/127) confirmed this case on native Windows Chrome and Edge in [browser run 38566035144](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38566035144). This covers more than same-tab reload but does **not** cover Safari restart, automatic eviction, host disk quota or private-window survival. [PR #129](https://github.com/StanleyLl0yd/FootClubSim/pull/129) also verified that Chrome and Edge really downloaded `footclubsim-initial-career.json` into their disposable profiles; its exact bytes matched the saved snapshot and were used for the same-origin recovery test.

## Headless Chrome startup reliability

An intermittent Windows Chrome smoke failure was observed on the M0 main branch
([attempt 1 of run 38513013078](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38513013078)):
the browser did not create `DevToolsActivePort` in its temporary profile.
The failed job passed when rerun without source changes. The CDP harness now
allows **one additional startup attempt with a new isolated profile**, reports
why each startup failed and keeps **all application assertions single-attempt**
once CDP is ready. A second startup failure remains a hard failure; this
does not declare the underlying platform flakiness resolved.

The macOS SafariDriver smoke additionally has an explicit isolated-origin IndexedDB deletion and **programmatic app JSON-import** recovery check, including rejection of a corrupted backup while preserving the active career. It is **not** a test of Safari Private Browsing, natural eviction, downloaded-file UX or full browser restart. This explicit deletion + file-input exercise succeeded in native Safari in [PR #120](https://github.com/StanleyLl0yd/FootClubSim/pull/120); Safari Private Browsing and full process restart remain unverified.

## Safari automation versus normal/private-browser persistence

The official [WebKit SafariDriver safeguard description](https://webkit.org/blog/6900/webdriver-support-in-safari-10/) explains that Safari's orange-address-field **Automation** windows start from isolated browsing state, separate from normal browsing settings and previous test sessions. Thus the native Safari CI verifies real Safari's M0 app behavior *within the automation session* but does **not** establish a regular profile surviving complete Safari application restart or actual Private Browsing behavior. A second/new SafariDriver session is **not an acceptable replacement** for either test. Do not mark those manual cases PASS based on SafariDriver or a WebKit emulator.

Follow [the dedicated exceptional-case matrix](M0_STORAGE_EDGE_ACCEPTANCE.md) for distinct disposable normal-profile full-application shutdown, real Safari downloaded-file recovery, and genuine File -> New Private Window observations. These remain open without explicit recorded native-browser evidence or an independently approved limited-acceptance decision.

## Safari WebDriver startup variability

[Browser run 38516820503](https://github.com/StanleyLl0yd/FootClubSim/actions/runs/38516820503)
initially failed on macOS because SafariDriver did not answer the **new session**
request before the harness's previous 15-second HTTP timeout. The same
application smoke passed when CI was rerun, without any source change.
Only the Safari **session-creation request** now allows 45 seconds; each
ordinary WebDriver command retains its 15-second timeout, and genuine
application failures must still fail the job. The repeated success
does not prove that SafariDriver startup cannot fail again.

The [exceptional storage acceptance matrix](M0_STORAGE_EDGE_ACCEPTANCE.md) supplies **separate, reproducible** native Safari Private Browsing, real quota/eviction, full browser shutdown and JSON backup/recovery procedures, along with an evidence form. It documents cases still **OPEN**; the existing injected quota error is not a real disk-quota test.

## Remaining work

The React/Vite technical shell and preliminary IndexedDB adapter already exist. Normal and flagged private Windows Chrome/Edge sessions are now in automated native-browser CI, but **macOS Safari Private Browsing and full Safari process-restart recovery, genuine disk-quota pressure, automatic storage eviction and native Safari OS-file download/recovery remain unverified**. Full career revisions and migrations, plus complete milestone exit audit, are also open. The adapter currently writes only new initial careers, with no overwrite or in-place revision update. This page is a non-shipping diagnostics artifact and is **not** a playable game.
