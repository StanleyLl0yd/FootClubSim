# M0 browser smoke check (manual)

This standalone QA page is deliberately **not** the planned React/Vite product UI. It exercises the existing headless domain modules in a real browser without introducing new dependencies, a hosted backend, real sports data or persistent browser storage.

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
5. Import malformed JSON and an unsupported schema; verify a readable rejection and no loss of the current displayed career.
6. With an initial career created, click **Сохранить в IndexedDB** and confirm success. Repeating the action with the same career ID must return `DUPLICATE` and keep the existing stored value.
7. Reload the page: in-memory state disappears. Click **Восстановить тестовую карьеру**, then verify the original club and ID are restored from IndexedDB.
8. In private browsing or with storage blocked, confirm that storage errors are surfaced without replacing the active in-memory career. Do not interpret this as a successful persistence test without recording real-browser observations.

Record browser brand, exact version, operating system, each observed result and any console errors. Target macOS Safari and Windows Chrome/Edge individually. No real-browser acceptance can be claimed from Node CI or a WebKit substitute.

## Remaining work

M0 still requires a Vite/React shell, full IndexedDB migration and recovery behavior, real Safari/Chromium evidence and the complete milestone exit audit. The adapter currently writes only new initial careers, with no overwrite or in-place revision update. The page is a non-shipping diagnostics artifact for manual validation and should not be represented as a playable game.
