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
- [PR #35](https://github.com/StanleyLl0yd/FootClubSim/pull/35): Linux Chromium renders the production-built React shell. This check alone does not exercise persistence.

These automated cases are for the production React shell, not a claim that each manual exercise on this standalone diagnostics page has been performed. Browser versions and any remaining untested scenarios must be recorded explicitly before release.

## Remaining work

The React/Vite technical shell and preliminary IndexedDB adapter already exist; however full career revisions/migrations, quota/eviction recovery, private-storage handling, Windows Chrome-specific initial-career compatibility is now automated; **actual private browsing, quota pressure, eviction and complete milestone exit audit** remain open. The adapter currently writes only new initial careers, with no overwrite or in-place revision update. This page is a non-shipping diagnostics artifact and is **not** a playable game.
